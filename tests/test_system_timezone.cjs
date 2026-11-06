const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Each case owns its process timezone. Native Date is never patched: the actual
// application polyfill is installed on a separate Date subclass in a VM realm.
const NativeDate = Date;
const NOW = NativeDate.parse("2026-01-15T23:30:42.123Z");
const options = { root: path.resolve(__dirname, "..") };
for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i];
    const value = process.argv[i + 1];
    assert(value, "Missing argument for " + flag);
    if (flag === "--source-root") options.root = path.resolve(value);
    else if (flag === "--overlay-root") options.overlay = path.resolve(value);
    else if (flag === "--case") options.case = value;
    else assert.fail("Unknown argument " + flag);
}

function sourcePath(relative) {
    const overlay = options.overlay && path.join(options.overlay, relative);
    return overlay && fs.existsSync(overlay)
        ? overlay
        : path.join(options.root, relative);
}

function load(host, relative, required, optional = []) {
    const file = sourcePath(relative);
    const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const found = new Set();
    const statements = source.statements.filter((node) => {
        if (ts.isImportDeclaration(node)) return false;
        if (!required) return true;
        const names = ts.isFunctionDeclaration(node)
            ? [node.name?.text]
            : ts.isVariableStatement(node)
              ? node.declarationList.declarations.map((item) => item.name.text)
              : [];
        for (const name of names) found.add(name);
        return names.some(
            (name) => required.includes(name) || optional.includes(name)
        );
    });
    for (const name of required || [])
        assert(found.has(name), relative + " must supply the real " + name);
    const code = statements
        .map((node) => node.getText(source).replace(/^export\s+/, ""))
        .join("\n");
    vm.runInContext(
        ts.transpileModule(code, {
            compilerOptions: {
                module: ts.ModuleKind.None,
                target: ts.ScriptTarget.ES5,
            },
        }).outputText,
        host,
        { filename: file }
    );
}

function installTimezone(host) {
    load(host, "src/polyfills/runtime.ts");
    load(host, "src/polyfills/index.ts");
    // The old implementation needs this captured getter. The fixed source no
    // longer has it; the function itself must always come from the tested tree.
    load(
        host,
        "src/settings/index.ts",
        ["applyTimezoneSetting"],
        ["systemTimezoneOffset"]
    );
}

function fixture() {
    let now = NOW;
    const timers = new Map();
    const elements = Object.create(null);
    let serial = 0;
    class PlayerDate extends NativeDate {
        constructor(...args) {
            super(...(args.length ? args : [now]));
        }
        static now() {
            return now;
        }
    }
    const host = vm.createContext({
        clearInterval(id) {
            timers.delete(id);
        },
        console,
        currentLocaleTag: () => "en",
        Date: PlayerDate,
        document: {
            getElementById(id) {
                return elements[id] || (elements[id] = { textContent: "" });
            },
        },
        metadataText: String,
        playTime: 17,
        playType: 0,
        setInterval(callback, delay) {
            const id = ++serial;
            timers.set(id, { callback, delay });
            return id;
        },
        translate: (value) => value,
    });
    host.window = host;
    installTimezone(host);
    load(host, "src/ui/index.ts", [
        "_t2",
        "formatClockTime",
        "initBackgroundIntervals",
    ]);
    load(host, "src/utils/helpers.ts", ["formatTwoDigits", "time2time"]);
    load(host, "src/localization/index.ts", ["formatLocaleDateTime"]);
    load(host, "src/channels/index.ts", [
        "formatEpgTime",
        "formatEpgDate",
        "epgTimezoneHours",
    ]);
    return {
        elements,
        host,
        setNow: (value) => {
            now = value;
        },
        timers,
    };
}

const localGetters = [
    "getFullYear",
    "getMonth",
    "getDate",
    "getDay",
    "getHours",
    "getMinutes",
    "getSeconds",
    "getMilliseconds",
    "getTimezoneOffset",
];
const utcGetters = [
    "getUTCFullYear",
    "getUTCMonth",
    "getUTCDate",
    "getUTCDay",
    "getUTCHours",
    "getUTCMinutes",
    "getUTCSeconds",
    "getUTCMilliseconds",
];
const two = (value) => String(value).padStart(2, "0");
const nativeClock = (date) =>
    [date.getHours(), date.getMinutes(), date.getSeconds()].map(two).join(":");

function assertEpoch(host, epoch) {
    const actual = new host.Date(epoch);
    const native = new NativeDate(epoch);
    assert.equal(actual.getTime(), epoch);
    assert.equal(Number(actual), epoch);
    assert.equal(actual.toISOString(), native.toISOString());
    for (const getter of utcGetters)
        assert.equal(actual[getter](), native[getter](), getter);
}

function assertSystem(f, epoch) {
    const { host } = f;
    f.setNow(epoch);
    const native = new NativeDate(epoch);
    const actual = new host.Date(epoch);
    for (const getter of localGetters)
        assert.equal(
            actual[getter](),
            native[getter](),
            getter + " at " + native.toISOString()
        );
    assert.equal(host.Date.getTimezoneOffset(), native.getTimezoneOffset());
    assert.equal(host.Date.now(), epoch);
    assertEpoch(host, epoch);
    assert.equal(host.formatClockTime(epoch / 1000), nativeClock(native));
    assert.equal(
        host.formatEpgTime(epoch / 1000),
        nativeClock(native).slice(0, 5)
    );
    assert.equal(host.time2time(epoch / 1000), nativeClock(native).slice(0, 5));
}

const cases = [
    { kind: "healthy", name: "system UTC", offset: 0, zone: "UTC" },
    { kind: "healthy", name: "system GMT+2", offset: -120, zone: "Etc/GMT-2" },
    {
        kind: "healthy",
        name: "system half-hour",
        offset: -330,
        zone: "Asia/Kolkata",
    },
    {
        kind: "change",
        name: "system zone changes after initialization",
        zone: "UTC",
    },
    {
        kind: "spring",
        name: "system spring transition",
        zone: "America/Los_Angeles",
    },
    {
        kind: "autumn",
        name: "system autumn transition",
        zone: "America/Los_Angeles",
    },
    {
        kind: "reset",
        name: "explicit offsets, repeated initialization and system reset",
        zone: "UTC",
    },
    {
        kind: "setters",
        name: "system native setters preserve DST and optional arguments",
        zone: "America/Los_Angeles",
    },
    {
        kind: "ui",
        name: "real UI clocks and EPG calendar share native local time",
        zone: "UTC",
    },
    {
        kind: "archive",
        name: "timezone changes preserve archive identity and epoch",
        zone: "Asia/Kolkata",
    },
];

function runCase(spec) {
    if (spec.kind === "archive") {
        const guideFixture = require(
            path.join(options.root, "tests/helpers/guide-runtime-fixture.cjs")
        );
        const start = NOW / 1000 - 100;
        const end = NOW / 1000 - 50;
        const f = guideFixture({ independentClock: true, now: NOW / 1000 });
        const h = f.host;
        installTimezone(h);
        h.epgList(0, 0, false);
        f.tick();
        f.complete([
            f.row(start, end, "Past", "same-programme"),
            f.row(
                NOW / 1000 - 10,
                NOW / 1000 + 100,
                "Current",
                "current-programme"
            ),
        ]);
        assert.equal(h.listArray.length, 2);
        const pastIndex = h.listArray.findIndex((item) => item.time === start);
        const currentIndex = h.listArray.findIndex(
            (item) => item.time === NOW / 1000 - 10
        );
        assert(
            pastIndex >= 0 && currentIndex >= 0 && pastIndex !== currentIndex
        );
        h.selIndex = pastIndex;
        const row = h.listArray[pastIndex];
        const current = h.listArray[currentIndex];
        const identity = row.programmeId;
        assert(
            identity && current.programmeId && identity !== current.programmeId
        );
        const snapshot = () =>
            JSON.stringify(
                h.listArray.map((item) => ({
                    end: item.time_to,
                    id: item.programmeId,
                    start: item.time,
                }))
            );
        const original = snapshot();
        const labels = new Set();
        for (const [index, zone, displayZone] of [
            [0, "Asia/Kolkata", "Asia/Kolkata"],
            [1, "Asia/Kolkata", "UTC"],
            [3, "America/Los_Angeles", "Etc/GMT-2"],
            [0, "America/Los_Angeles", "America/Los_Angeles"],
            [null, "Etc/GMT-2", "Etc/GMT-2"],
        ]) {
            process.env.TZ = zone;
            if (index !== null)
                assert.equal(h.applyTimezoneSetting(index), index);
            process.env.TZ = displayZone;
            const expected = nativeClock(new NativeDate(start * 1000)).slice(
                0,
                5
            );
            process.env.TZ = zone;
            const label = h.formatEpgTime(start);
            assert.equal(label, expected);
            labels.add(label);
            assert.equal(snapshot(), original);
            assert.equal(h.listArray[h.selIndex].programmeId, identity);
            assert(
                h
                    .itemEPG(current, currentIndex)
                    .includes("ott-epg-current-title")
            );
            assert(
                !h.itemEPG(row, pastIndex).includes("ott-epg-current-title")
            );
            assert.equal(h.Date.now(), NOW);
            assert.equal(h.epgTimezoneHours({ rec: 48, ts: 3600 }), 0);
            assert.equal(
                f.calls.filter((call) => call[0] === "archive").length,
                0
            );
        }
        assert(
            labels.size > 1,
            "labels change while the underlying schedule does not"
        );
        h.selectEpg();
        assert.deepEqual(
            f.calls.filter((call) => call[0] === "archive"),
            [["archive", start]]
        );
        assert.equal(snapshot(), original);
        return;
    }
    const f = fixture();
    const h = f.host;
    assert.equal(h.applyTimezoneSetting(0), 0);
    if (spec.kind === "healthy") {
        assert.equal(
            new NativeDate(NOW).getTimezoneOffset(),
            spec.offset,
            "native TZ fixture prerequisite"
        );
        assertSystem(f, NOW);
    } else if (spec.kind === "change") {
        assert.equal(new NativeDate(NOW).getTimezoneOffset(), 0);
        assertSystem(f, NOW);
        process.env.TZ = "Etc/GMT-2";
        assert.equal(
            new NativeDate(NOW).getTimezoneOffset(),
            -120,
            "native zone actually changed"
        );
        // No second settings application: System must not become a frozen offset.
        assertSystem(f, NOW);
        process.env.TZ = "Asia/Kolkata";
        assertSystem(f, NOW);
    } else if (spec.kind === "spring" || spec.kind === "autumn") {
        const times =
            spec.kind === "spring"
                ? ["2026-03-08T09:30:00Z", "2026-03-08T10:30:00Z"]
                : ["2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z"];
        const epochs = times.map((value) => NativeDate.parse(value));
        assert.notEqual(
            new NativeDate(epochs[0]).getTimezoneOffset(),
            new NativeDate(epochs[1]).getTimezoneOffset(),
            "native DST prerequisite"
        );
        for (const epoch of epochs) assertSystem(f, epoch);
        assert.equal(epochs[1] - epochs[0], 3600000);
    } else if (spec.kind === "reset") {
        for (const [index, expected] of [
            [1, "23:30:42"],
            [3, "01:30:42"],
        ]) {
            assert.equal(h.applyTimezoneSetting(index), index);
            for (const zone of ["America/Los_Angeles", "Asia/Kolkata"]) {
                process.env.TZ = zone;
                h.applyPolyfills();
                assert.equal(h.formatClockTime(NOW / 1000), expected);
                // Explicit UTC preserves the legacy -60 * 0 result.
                assert.equal(
                    h.Date.getTimezoneOffset(),
                    index === 1 ? -0 : -120
                );
                assertEpoch(h, NOW);
            }
        }
        assert.equal(h.applyTimezoneSetting(0), 0);
        assertSystem(f, NOW);
        process.env.TZ = "Etc/GMT-2";
        assertSystem(f, NOW);
        h.applyPolyfills();
        assertSystem(f, NOW);
    } else if (spec.kind === "setters") {
        const epoch = NativeDate.parse("2026-03-08T09:30:00Z");
        for (const [method, args] of [
            ["setHours", [3, 45, 12, 345]],
            ["setFullYear", [2026, 6, 15]],
        ]) {
            const actual = new h.Date(epoch);
            const native = new NativeDate(epoch);
            assert.equal(
                actual[method](...args),
                native[method](...args),
                method
            );
            assert.equal(actual.getTime(), native.getTime(), method + " epoch");
            for (const getter of localGetters)
                assert.equal(
                    actual[getter](),
                    native[getter](),
                    method + "/" + getter
                );
            assert.equal(
                actual.toString(),
                native.toString(),
                method + " native display"
            );
        }
    } else if (spec.kind === "ui") {
        h.initBackgroundIntervals();
        const clocks = [...f.timers.values()].filter(
            (timer) => timer.delay === 1000
        );
        assert.equal(clocks.length, 1);
        for (const zone of ["UTC", "Etc/GMT-2", "Asia/Kolkata"]) {
            process.env.TZ = zone;
            const native = new NativeDate(NOW);
            clocks[0].callback();
            for (const id of ["current_t", "list_t", "permanentTime"])
                assert.equal(
                    f.elements[id].textContent,
                    nativeClock(native).slice(0, 5),
                    zone + "/" + id
                );
            for (const id of ["current_s", "list_s"])
                assert.equal(
                    f.elements[id].textContent,
                    ":" + two(native.getSeconds())
                );
            assert.equal(h.playTime, 17);
            assertEpoch(h, NOW);
            const intl = new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "2-digit",
                weekday: "short",
            }).format(native);
            assert.equal(h.formatEpgDate(NOW / 1000), intl);
            vm.runInContext("Intl = undefined", h);
            const fallback =
                ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][native.getDay()] +
                "\u00a0" +
                two(native.getDate()) +
                "/" +
                two(native.getMonth() + 1);
            assert.equal(h.formatEpgDate(NOW / 1000), fallback);
            h.Intl = Intl;
        }
    } else assert.fail("Unknown case " + spec.kind);
}

if (options.case) {
    const spec = cases.find((item) => item.name === options.case);
    assert(spec, "Unknown child case");
    runCase(spec);
} else {
    const test = require("node:test");
    for (const spec of cases)
        test(spec.name, () => {
            const args = [
                __filename,
                "--source-root",
                options.root,
                "--case",
                spec.name,
            ];
            if (options.overlay) args.push("--overlay-root", options.overlay);
            const result = spawnSync(process.execPath, args, {
                encoding: "utf8",
                env: { ...process.env, TZ: spec.zone },
                maxBuffer: 1024 * 1024,
                timeout: 20000,
                windowsHide: true,
            });
            assert.ifError(result.error);
            assert.equal(result.signal, null, result.stdout + result.stderr);
            assert.equal(result.status, 0, result.stdout + result.stderr);
        });
}
