const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

const source = fs.readFileSync(
    path.join(__dirname, "../src/ui/modern-artwork.ts"),
    "utf8"
);
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES5 },
}).outputText;
const jpeg = { bodyBase64: "/9j/4A==", contentType: "image/jpeg" };
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(url = "https://player.example/") {
    const dom = new JSDOM("<main></main>", { runScripts: "outside-only", url });
    const w = dom.window;
    const created = [],
        revoked = [],
        calls = [];
    w.URL.createObjectURL = (blob) => {
        const url = `blob:fixture-${created.length}`;
        created.push({ blob, url });
        return url;
    };
    w.URL.revokeObjectURL = (url) => revoked.push(url);
    w.eval(compiled);
    const loader = w.__ottModernArtworkFactory(w);
    return {
        calls,
        close() {
            loader.reset();
            dom.window.close();
        },
        created,
        dom,
        image() {
            const image = w.document.createElement("img");
            w.document.querySelector("main").appendChild(image);
            return image;
        },
        loader,
        native() {
            w.__TAURI__ = {
                core: {
                    invoke: (command, args) =>
                        new Promise((resolve, reject) => {
                            calls.push({ args, command, reject, resolve });
                        }),
                },
            };
        },
        revoked,
        w,
    };
}

test("Capacitor HTTPS localhost retains its configured native mixed-content path", () => {
    const f = fixture("https://localhost/");
    try {
        f.w.Capacitor = { isNativePlatform: () => true };
        f.w.XMLHttpRequest = function () {
            throw new Error("Capacitor is not a ModeA server");
        };
        const image = f.image();
        f.loader.bind(image, "http://images.example/a.jpg");
        assert.equal(image.src, "http://images.example/a.jpg");
    } finally {
        f.close();
    }
});

test("HTTP pages keep direct HTTP artwork; handlers exist before loading", () => {
    const f = fixture("http://localhost:8443/");
    try {
        const image = f.image();
        f.loader.bind(image, "http://posters.example/posters/l/a.jpg");
        assert.equal(image.src, "http://posters.example/posters/l/a.jpg");
        assert.equal(typeof image.onload, "function");
        image.onload();
        assert.equal(image.style.display, "");
        image.onerror();
        assert.equal(image.style.display, "none");
        assert.equal(image.hasAttribute("src"), false);
    } finally {
        f.close();
    }
});

test("HTTPS artwork stays direct and unchanged; unmapped HTTP never auto-upgrades", () => {
    const f = fixture();
    try {
        const image = f.image();
        f.loader.bind(image, "https://images.example/a.jpg");
        assert.equal(image.src, "https://images.example/a.jpg");
        f.loader.bind(image, "http://images.example/a.jpg");
        assert.equal(image.hasAttribute("src"), false);
        assert.equal(image.style.display, "none");
        for (const url of [
            "javascript:alert(1)",
            "https://a:b@images.example/a.jpg",
            "file:///tmp/a.jpg",
            "http://images.example/a.jpg#x",
            "http://images.example/\na.jpg",
        ])
            f.loader.bind(image, url);
        assert.equal(image.hasAttribute("src"), false);
    } finally {
        f.close();
    }
});

test("hosted artwork maps only explicit origin/directory/filename pairs", () => {
    const f = fixture();
    try {
        f.w.__OTTPLAY_HOSTED__ = {
            artwork: {
                routes: [
                    {
                        path: "/vportal/artwork/provider-1/l/",
                        upstream: "http://posters.example/posters/l/",
                    },
                ],
            },
            version: 1,
        };
        const image = f.image();
        f.loader.bind(image, "http://posters.example/posters/l/a.jpg");
        assert.equal(
            image.getAttribute("src"),
            "/vportal/artwork/provider-1/l/a.jpg"
        );
        for (const url of [
            "http://evil.example/posters/l/a.jpg",
            "http://posters.example/posters/h/a.jpg",
            "http://posters.example/posters/l/../a.jpg",
            "http://posters.example/posters/l/%2fescape.jpg",
            "http://posters.example/posters/l/a.jpg?url=http://elsewhere/",
            "http://posters.example/posters/l/a.svg",
        ]) {
            f.loader.bind(image, url);
            assert.equal(image.hasAttribute("src"), false, url);
        }
        f.w.__OTTPLAY_HOSTED__.artwork.routes.push(
            f.w.__OTTPLAY_HOSTED__.artwork.routes[0]
        );
        f.loader.bind(image, "http://posters.example/posters/l/a.jpg");
        assert.equal(
            image.hasAttribute("src"),
            false,
            "ambiguous route denied"
        );
    } finally {
        f.close();
    }
});

test("native poster fetch deduplicates cards/hero, uses blobs and revokes after load", async () => {
    const f = fixture("http://tauri.localhost/");
    try {
        f.native();
        const a = f.image(),
            b = f.image();
        f.loader.bind(a, "http://images.example/a.jpg");
        f.loader.bind(b, "http://images.example/a.jpg");
        assert.equal(a.hasAttribute("src"), false);
        await tick();
        assert.equal(f.calls.length, 1);
        assert.equal(f.calls[0].command, "artwork_fetch");
        assert.equal(f.calls[0].args.url, "http://images.example/a.jpg");
        f.calls[0].resolve(jpeg);
        await tick();
        assert.equal(f.created.length, 2);
        a.onload();
        b.onload();
        assert.equal(f.revoked.length, 2);
        const c = f.image();
        f.loader.bind(c, "http://images.example/a.jpg");
        await tick();
        assert.equal(f.calls.length, 1, "cached bytes reused");
        assert.match(c.src, /^blob:/);
        f.loader.bind(c, "http://images.example/a.jpg");
        assert.equal(f.created.length, 3, "unchanged node is not rebuilt");
    } finally {
        f.close();
    }
});

test("detached/stale hero responses never overwrite the new selection", async () => {
    const f = fixture();
    try {
        f.native();
        const image = f.image();
        f.loader.bind(image, "http://images.example/a.jpg");
        await tick();
        f.loader.bind(image, "http://images.example/b.jpg");
        await tick();
        f.calls[0].resolve(jpeg);
        await tick();
        assert.equal(f.created.length, 0);
        f.calls[1].resolve(jpeg);
        await tick();
        assert.equal(f.created.length, 1);
        image.remove();
        f.loader.prune();
        assert.equal(f.revoked.length, 1);
        assert.equal(image.hasAttribute("src"), false);
    } finally {
        f.close();
    }
});

test("scrolling bounds native concurrency; reset retires queued work and stale results", async () => {
    const f = fixture();
    try {
        f.native();
        for (let i = 0; i < 20; i++)
            f.loader.bind(f.image(), `http://images.example/${i}.jpg`);
        await tick();
        assert.equal(f.calls.length, 4);
        f.loader.reset();
        const image = f.image();
        f.loader.bind(image, "http://images.example/fresh.jpg");
        await tick();
        assert.equal(
            f.calls.length,
            4,
            "native in-flight count remains bounded across reset"
        );
        for (let i = 0; i < 4; i++) f.calls[i].resolve(jpeg);
        await tick();
        assert.equal(f.created.length, 0, "old screen results discarded");
        assert.equal(f.calls.length, 5, "old queued URLs not fetched");
        f.calls[4].resolve(jpeg);
        await tick();
        assert.match(image.src, /^blob:/);
    } finally {
        f.close();
    }
});

test("malformed/native SVG or oversize responses cannot become image URLs", async () => {
    const f = fixture();
    try {
        f.native();
        const values = [
            { bodyBase64: "PHN2Zy8+", contentType: "image/svg+xml" },
            { bodyBase64: "not base64", contentType: "image/jpeg" },
            { bodyBase64: "A".repeat(5592410), contentType: "image/jpeg" },
        ];
        for (let i = 0; i < values.length; i++) {
            const image = f.image();
            f.loader.bind(image, `http://images.example/${i}.jpg`);
            await tick();
            f.calls[i].resolve(values[i]);
            await tick();
            assert.equal(image.hasAttribute("src"), false);
        }
        assert.equal(f.created.length, 0);
    } finally {
        f.close();
    }
});

test("local HTTPS uses same-origin binary ModeA route and aborts on hide", async () => {
    const f = fixture("https://127.0.0.1:8443/pc/");
    try {
        const requests = [];
        f.w.XMLHttpRequest = class {
            constructor() {
                requests.push(this);
            }
            open(method, url) {
                this.method = method;
                this.url = url;
            }
            setRequestHeader(name, value) {
                this.header = [name, value];
            }
            send(body) {
                this.body = body;
            }
            abort() {
                this.aborted = true;
                this.onabort();
            }
        };
        const image = f.image();
        f.loader.bind(image, "http://images.example/a.jpg");
        assert.equal(requests.length, 1);
        assert.equal(requests[0].method, "POST");
        assert.equal(requests[0].url, "/artwork");
        assert.equal(requests[0].responseType, "blob");
        requests[0].status = 200;
        requests[0].response = new f.w.Blob(["JPEG"], { type: "image/jpeg" });
        requests[0].onload();
        await tick();
        assert.match(image.src, /^blob:/);
        f.loader.bind(f.image(), "http://images.example/b.jpg");
        f.loader.reset();
        assert.equal(requests[1].aborted, true);
        await tick();
        assert.equal(image.hasAttribute("src"), false);
    } finally {
        f.close();
    }
});

test("decorate loads only attached visible cards; unknown remote server is not an open relay", () => {
    const f = fixture("https://server.example/pc/");
    try {
        const root = f.w.document.querySelector("main");
        root.innerHTML =
            '<img data-modern-artwork="http://images.example/a.jpg">';
        f.w.XMLHttpRequest = function () {
            throw new Error("remote relay must not be attempted");
        };
        f.loader.decorate(root);
        assert.equal(root.firstChild.hasAttribute("src"), false);
        root.firstChild.setAttribute(
            "data-modern-artwork",
            "https://images.example/a.jpg"
        );
        f.loader.decorate(root);
        assert.equal(root.firstChild.src, "https://images.example/a.jpg");
    } finally {
        f.close();
    }
});

test("repaint cannot join an aborted local artwork request for the same URL", async () => {
    const f = fixture("https://localhost:8443/");
    try {
        const requests = [];
        f.w.XMLHttpRequest = class {
            constructor() {
                requests.push(this);
            }
            open() {}
            setRequestHeader() {}
            send() {}
            abort() {
                this.aborted = true;
                this.onabort();
            }
        };
        const root = f.w.document.querySelector("main");
        const markup =
            '<img data-modern-artwork="http://images.example/a.jpg">';
        root.innerHTML = markup;
        f.loader.decorate(root);
        root.innerHTML = markup;
        f.loader.decorate(root);
        assert.equal(requests[0].aborted, true);
        assert.equal(requests.length, 2, "new node needs a live request");
        requests[1].status = 200;
        requests[1].response = new f.w.Blob(["JPEG"], { type: "image/jpeg" });
        requests[1].onload();
        await tick();
        assert.match(root.firstChild.src, /^blob:/);
        root.firstChild.onload();
        assert.equal(root.firstChild.style.display, "");
    } finally {
        f.close();
    }
});
