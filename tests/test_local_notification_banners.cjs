const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const loadBanners = require("./helpers/notification-banners.cjs");
const root = path.resolve(__dirname, "..");

function read(file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}
function emit(text) {
    return ts.transpileModule(text, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
}
function functionCode(file, name) {
    const ast = ts.createSourceFile(
        file,
        read(file),
        ts.ScriptTarget.Latest,
        true
    );
    const fn = ast.statements.find(
        (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
    );
    assert(fn, name);
    return emit(fn.getText(ast));
}
function fixture(flags = {}) {
    const dom = new JSDOM(
        '<body class="booting"><div id="notifications"></div></body>',
        { pretendToBeVisual: true }
    );
    const w = dom.window;
    let now = 0,
        sequence = 0;
    const tasks = new Map();
    Object.assign(w, flags);
    Object.defineProperty(w.performance, "now", { value: () => now });
    w.setTimeout = (fn, ms) => {
        tasks.set(++sequence, { at: now + ms, fn });
        return sequence;
    };
    w.clearTimeout = (id) => tasks.delete(id);
    const banners = loadBanners({ Date: { now: () => now } });
    const scope = {
        createNotificationBanners: banners.createNotificationBanners,
        exports: {},
        window: w,
    };
    vm.runInNewContext(
        functionCode("src/ui/index.ts", "showShift") +
            functionCode("src/commands/index.ts", "showPopup"),
        scope
    );
    Object.assign(w, scope.exports);
    return {
        dom,
        notice: () => w.document.querySelector(".remote-notify-local"),
        tasks,
        tick(ms) {
            const end = now + ms;
            for (;;) {
                const next = [...tasks]
                    .filter(([, item]) => item.at <= end)
                    .sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                now = next[1].at;
                tasks.delete(next[0]);
                next[1].fn();
            }
            now = end;
        },
        w,
    };
}

for (const [name, flags] of Object.entries({
    Capacitor: { Capacitor: {} },
    "hosted browser / OTTserver": {},
    Tauri: { __TAURI__: {} },
    "TV shared client": { platform: "webos" },
})) {
    test(
        name +
            " local notices use the animated renderer before remote initialization",
        () => {
            const f = fixture(flags);
            try {
                assert.equal(f.w.__ottRemoteNotifications, undefined);
                f.w.showShift("Settings saved");
                const service = f.w.__ottNotificationBanners;
                assert(service);
                assert.equal(f.notice().textContent, "Settings saved");
                assert(f.notice().classList.contains("remote-notify-running"));
                f.w.__ottRemoteNotifications = { enabled: () => false };
                f.w.showPopup("Native setting: On", 5);
                assert.equal(f.w.__ottNotificationBanners, service);
                assert.equal(f.notice().textContent, "Native setting: On");
                assert.equal(
                    f.w.document.querySelectorAll(".notify").length,
                    1
                );
                assert.equal(f.w.document.querySelector("#info"), null);
                f.tick(4999);
                assert(f.notice());
                f.tick(1);
                assert.equal(f.notice(), null);
            } finally {
                f.dom.window.close();
            }
        }
    );
}

test("both legacy entrypoints keep hostile metadata literal and replace local notices safely", () => {
    const f = fixture();
    try {
        const message =
            '<b>File &amp;</b> <img src=x onerror=alert(1)> <span class="system-icons">On</span>';
        f.w.showPopup("Older", 5);
        f.tick(2500);
        f.w.showShift(message);
        assert.equal(f.notice().textContent, message);
        assert.equal(f.notice().querySelector("b,img,span,script"), null);
        f.tick(2500);
        assert.equal(
            f.notice().textContent,
            message,
            "expired prior timer cannot remove the replacement"
        );
        f.tick(500);
        assert.equal(f.notice(), null);
        assert.equal(f.tasks.size, 0);
    } finally {
        f.dom.window.close();
    }
});

test("standby clears local notices without requiring a remote notification receiver", () => {
    const f = fixture();
    try {
        const scope = { exports: {}, Promise };
        vm.runInNewContext(emit(read("src/core/standby.ts")), scope);
        const gate = scope.exports.installStandby(
            f.w,
            () => "0",
            () => {}
        );
        f.w.showShift("Before standby");
        assert(f.notice());
        gate.set(true);
        assert.equal(f.notice(), null);
        f.w.showPopup("While in standby");
        assert.equal(f.notice(), null);
    } finally {
        f.dom.window.close();
    }
});

test("the shared distribution template has no legacy notification element or yellow-edge renderer", () => {
    const html = read("index.html");
    assert(!/id=["']info["']/.test(html));
    assert(!/@keyframes\s+notify(?:In|Out)/.test(html));
    assert(!/^\s*\.notify\s*\{/m.test(html));
    assert.match(
        read("scripts/classic-bundle.cjs"),
        /"build\/ui\/notification-banners\.js"/
    );
    assert.match(
        read("src/ui/index.ts"),
        /import \{ createNotificationBanners \} from "\.\/notification-banners"/
    );
    assert.match(
        read("src/commands/index.ts"),
        /import \{ createNotificationBanners \} from "\.\.\/ui\/notification-banners"/
    );
});

test("explicit popup lifetime and full plain text retain the remote command contract", () => {
    const f = fixture();
    try {
        const message = "Long local feedback ".repeat(40);
        f.w.showPopup(message, 30);
        assert.equal(f.notice().textContent, message);
        f.tick(29999);
        assert(f.notice());
        f.tick(1);
        assert.equal(f.notice(), null);
        f.w.showPopup("Brief", 0.25);
        f.tick(249);
        assert(f.notice());
        f.tick(1);
        assert.equal(f.notice(), null);
    } finally {
        f.dom.window.close();
    }
});
