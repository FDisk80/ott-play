const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const acorn = require("acorn");

const source = fs.readFileSync(
    path.join(__dirname, "../src/ui/color-values.ts"),
    "utf8"
);
const code = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES5,
    },
}).outputText;
acorn.parse(code, { ecmaVersion: 5 });
const host = { window: {} };
vm.runInNewContext(code, host);
const api = host.window.__ottColorValues;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("HEX accepts only exact short or full hex and normalizes uppercase", () => {
    for (const [text, expected] of [
        ["#abc", "#AABBCC"],
        ["#aBcDeF", "#ABCDEF"],
        ["#000", "#000000"],
        ["#fff", "#FFFFFF"],
    ])
        assert.equal(api.normalizeHex(text), expected);
    for (const text of [
        "",
        "abc",
        "#12",
        "#1234",
        "#12345",
        "#1234567",
        "#12345678",
        "#ggg",
        " #abc",
        "#abc ",
        "#abc\n",
        "#123456\n",
        "#１２３",
        "#abc;color:red",
        "rgb(1,2,3)",
        "red",
        "url(x)",
        null,
        undefined,
        123,
    ]) {
        assert.equal(api.normalizeHex(text), null, String(text));
        assert.equal(api.hexToRgb(text), null, String(text));
        assert.equal(api.hexToHsv(text), null, String(text));
    }
});

test("RGB text requires three bounded decimal integers without coercion", () => {
    assert.deepEqual(plain(api.parseRgb("0", "127", "255")), {
        b: 255,
        g: 127,
        r: 0,
    });
    assert.deepEqual(plain(api.parseRgb("001", "02", "3")), {
        b: 3,
        g: 2,
        r: 1,
    });
    for (const bad of [
        "",
        "256",
        "-1",
        "+1",
        "1.0",
        "1e2",
        "0xff",
        "1px",
        " 1",
        "1 ",
        "1\n",
        "１２",
        "0000",
        "NaN",
        "Infinity",
        null,
        undefined,
        1,
        false,
    ]) {
        for (let index = 0; index < 3; index++) {
            const parts = ["0", "0", "0"];
            parts[index] = bad;
            assert.equal(api.parseRgb(...parts), null, String(bad));
        }
    }
});

test("HSV text accepts finite bounded decimals and canonicalizes hue360", () => {
    assert.deepEqual(plain(api.parseHsv("359.5", ".5", "100.0")), {
        h: 359.5,
        s: 0.5,
        v: 100,
    });
    assert.deepEqual(plain(api.parseHsv("360", "0", "0")), {
        h: 0,
        s: 0,
        v: 0,
    });
    assert.deepEqual(plain(api.parseHsv("0.", "000.25", "50")), {
        h: 0,
        s: 0.25,
        v: 50,
    });
    for (const bad of [
        "",
        ".",
        "-0",
        "-1",
        "+1",
        "1e2",
        "0x10",
        "25%",
        "1deg",
        " 1",
        "1 ",
        "1\n",
        "1\r\n",
        "NaN",
        "Infinity",
        "1.2.3",
        "0".repeat(33),
        null,
        undefined,
        1,
        false,
    ]) {
        for (let index = 0; index < 3; index++) {
            const parts = ["0", "0", "0"];
            parts[index] = bad;
            assert.equal(api.parseHsv(...parts), null, String(bad));
        }
    }
    assert.equal(api.parseHsv("360.1", "0", "0"), null);
    assert.equal(api.parseHsv("0", "100.1", "0"), null);
    assert.equal(api.parseHsv("0", "0", "100.1"), null);
});

test("canonical RGB and HSV conversions cover primaries, secondaries and gray", () => {
    const vectors = [
        ["#000000", { b: 0, g: 0, r: 0 }, { h: 0, s: 0, v: 0 }],
        ["#FFFFFF", { b: 255, g: 255, r: 255 }, { h: 0, s: 0, v: 100 }],
        ["#FF0000", { b: 0, g: 0, r: 255 }, { h: 0, s: 100, v: 100 }],
        ["#FFFF00", { b: 0, g: 255, r: 255 }, { h: 60, s: 100, v: 100 }],
        ["#00FF00", { b: 0, g: 255, r: 0 }, { h: 120, s: 100, v: 100 }],
        ["#00FFFF", { b: 255, g: 255, r: 0 }, { h: 180, s: 100, v: 100 }],
        ["#0000FF", { b: 255, g: 0, r: 0 }, { h: 240, s: 100, v: 100 }],
        ["#FF00FF", { b: 255, g: 0, r: 255 }, { h: 300, s: 100, v: 100 }],
    ];
    for (const [hex, rgb, hsv] of vectors) {
        assert.deepEqual(plain(api.hexToRgb(hex)), rgb);
        assert.deepEqual(plain(api.hexToHsv(hex)), hsv);
        assert.equal(api.rgbToHex(rgb), hex);
        assert.equal(api.hsvToHex(hsv), hex);
    }
    const gray = api.hexToHsv("#808080");
    assert.equal(gray.h, 0);
    assert.equal(gray.s, 0);
    assert(Math.abs(gray.v - 50.19607843137255) < 1e-12);
});

test("HSV quantizes only output bytes, including hue360 and achromatic colors", () => {
    assert.equal(api.hsvToHex({ h: 360, s: 100, v: 100 }), "#FF0000");
    assert.equal(api.hsvToHex({ h: 30, s: 100, v: 100 }), "#FF8000");
    assert.equal(api.hsvToHex({ h: 210, s: 100, v: 100 }), "#0080FF");
    assert.equal(api.hsvToHex({ h: 279.25, s: 0, v: 50 }), "#808080");
    assert.equal(api.hsvToHex({ h: 279.25, s: 67.5, v: 0 }), "#000000");
    assert.equal(api.hsvToHex({ h: 0, s: 0, v: 0.1 }), "#000000");
    assert.equal(api.hsvToHex({ h: 0, s: 0, v: 0.2 }), "#010101");
});

test("conversion objects reject nonnumeric, fractional RGB and out-of-range data", () => {
    for (const bad of [
        NaN,
        Infinity,
        -Infinity,
        -1,
        256,
        0.5,
        "1",
        null,
        undefined,
    ]) {
        for (const key of ["r", "g", "b"])
            assert.equal(api.rgbToHex({ b: 0, g: 0, r: 0, [key]: bad }), null);
    }
    for (const bad of [NaN, Infinity, -Infinity, -1, "1", null, undefined]) {
        for (const key of ["h", "s", "v"])
            assert.equal(api.hsvToHex({ h: 0, s: 0, v: 0, [key]: bad }), null);
    }
    assert.equal(api.hsvToHex({ h: 360.001, s: 0, v: 0 }), null);
    assert.equal(api.hsvToHex({ h: 0, s: 100.001, v: 0 }), null);
    assert.equal(api.hsvToHex({ h: 0, s: 0, v: 100.001 }), null);
    for (const bad of [null, undefined, {}, [], "#ffffff"]) {
        assert.equal(api.rgbToHex(bad), null);
        assert.equal(api.hsvToHex(bad), null);
    }
});

test("HEX round-trips exactly through RGB and full-precision HSV at byte boundaries", () => {
    const values = [0, 1, 2, 15, 16, 31, 63, 64, 127, 128, 192, 254, 255];
    for (const r of values)
        for (const g of values)
            for (const b of values) {
                const hex =
                    "#" +
                    [r, g, b]
                        .map((value) => value.toString(16).padStart(2, "0"))
                        .join("")
                        .toUpperCase();
                assert.equal(api.rgbToHex(api.hexToRgb(hex)), hex);
                assert.equal(api.hsvToHex(api.hexToHsv(hex)), hex);
            }
});

test("conversions preserve caller-owned objects", () => {
    const rgb = Object.freeze({ b: 86, g: 52, r: 18 });
    const hsv = Object.freeze({ h: 360, s: 100, v: 100 });
    assert.equal(api.rgbToHex(rgb), "#123456");
    assert.equal(api.hsvToHex(hsv), "#FF0000");
    assert.deepEqual(rgb, { b: 86, g: 52, r: 18 });
    assert.deepEqual(hsv, { h: 360, s: 100, v: 100 });
});

test("browser namespace exposes the same seven pure functions without DOM access", () => {
    const browser = { window: {} };
    vm.runInNewContext(code, browser);
    const names = [
        "normalizeHex",
        "parseRgb",
        "parseHsv",
        "rgbToHex",
        "hexToRgb",
        "hexToHsv",
        "hsvToHex",
    ];
    assert.deepEqual(
        Object.keys(browser.window.__ottColorValues).sort(),
        names.sort()
    );
    for (const name of names)
        assert.equal(browser.window.__ottColorValues[name], browser[name]);
    assert.equal(
        browser.window.__ottColorValues.normalizeHex("#AbC"),
        "#AABBCC"
    );
});
