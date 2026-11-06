const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const policyPath = path.join(
    root,
    "src-tauri/examples/favorites-storage-smoke/provider-storage-validation.js"
);
const policyHost = { window: {} };
vm.runInNewContext(fs.readFileSync(policyPath, "utf8"), policyHost);
const policy = policyHost.window.nativeProviderTargetValidation;
const lzHost = { exports: {} };
const compiled = ts.transpileModule(
    fs.readFileSync(path.join(root, "src/utils/lzstring.ts"), "utf8"),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
        reportDiagnostics: true,
    }
);
assert.equal(compiled.diagnostics.length, 0);
vm.runInNewContext(compiled.outputText, lzHost);
const lz = lzHost.exports;
const marker = "\x01LZ\x01";
let cases = 0;
for (const kind of ["tv", "media"]) {
    const expected = policy.expected[kind];
    assert(expected.length > 8192);
    const raw = marker + lz.compress(expected);
    const decoded = lz.decompress(raw.slice(marker.length));
    assert.equal(decoded, expected);
    assert(raw.length < expected.length);
    assert.equal(policy.validate(kind, decoded, raw), true);
    const wrong = JSON.stringify({
        padding: "different".repeat(1024),
        title: "wrong-json",
    });
    const wrongRaw = marker + lz.compress(wrong);
    assert.throws(
        () => policy.validate(kind, expected, expected),
        /not stored through the actual LZ/
    );
    assert.throws(() => policy.validate(kind, raw, raw), /exact original JSON/);
    assert.throws(
        () => policy.validate(kind, wrong, wrongRaw),
        /exact original JSON/
    );
    assert.throws(
        () => policy.validate(kind, expected, marker + expected),
        /did not become shorter/
    );
    assert.throws(
        () => policy.validate(kind, expected, raw.slice(1)),
        /not stored through the actual LZ/
    );
    cases += 6;
}
console.log(
    "PASS native provider compression acceptance: " +
        cases +
        " actual-LZ positive/negative cases; no native runtime qualification"
);

// Exercise the actual generated module graph without creating a generated file
// or launching a native view. A new storage import must be bundled AND pinned.
{
    const crypto = require("node:crypto");
    const prepare = path.join(
        root,
        "src-tauri/examples/favorites-storage-smoke/prepare.cjs"
    );
    let generated;
    vm.runInNewContext(
        fs.readFileSync(prepare, "utf8"),
        {
            __dirname: path.dirname(prepare),
            require(name) {
                if (name !== "node:fs") return require(name);
                return {
                    readFileSync: fs.readFileSync,
                    writeFileSync(filename, text) {
                        assert.equal(
                            filename,
                            path.join(
                                path.dirname(prepare),
                                "generated-modules.js"
                            )
                        );
                        assert.equal(
                            generated,
                            undefined,
                            "one generated fixture"
                        );
                        generated = text;
                    },
                };
            },
        },
        { filename: prepare }
    );
    assert.equal(typeof generated, "string");
    const fixture = { document: { cookie: "" }, window: {} };
    vm.runInNewContext(generated, fixture);
    const storage = fixture.window.nativeFixtureLoad("storage-main");
    assert.equal(typeof storage.portableSettingsSnapshot, "function");
    const colors = fixture.window.nativeFixtureLoad(
        "../settings/interface-colors"
    );
    assert.equal(
        colors.normalizeInterfaceColorConfig(
            '{"colors":{"text":"#abcdef"},"version":1}'
        ),
        '{"version":1,"colors":{"text":"#ABCDEF"}}'
    );
    assert.equal(
        colors.normalizeInterfaceColorConfig(
            '{"version":1,"colors":{"unknown":"#ABCDEF"}}'
        ),
        null
    );
    assert.throws(
        () => fixture.window.nativeFixtureLoad("missing-module"),
        /Unknown fixture module/
    );
    const tuple = fs
        .readFileSync(path.join(root, "scripts/ci-native-favorites.py"), "utf8")
        .match(/MODULE_FILES = \(([^)]+)\)/);
    assert(tuple, "native verifier retains its explicit module pin list");
    const expected = [...tuple[1].matchAll(/'([^']+)'/g)].map(
        (match) => match[1]
    );
    assert.equal(
        new Set(expected).size,
        expected.length,
        "unique verifier module pins"
    );
    const pins = fixture.window.nativeSourcePins;
    assert.deepEqual(
        Object.keys(pins).sort(),
        expected.sort(),
        "generated modules match verified modules"
    );
    for (const name of expected)
        assert.equal(
            pins[name],
            crypto
                .createHash("sha256")
                .update(fs.readFileSync(path.join(root, name)))
                .digest("hex"),
            name
        );
    console.log(
        "PASS actual native fixture generated storage/color dependencies, strict unknown import and exact source pins; no native runtime"
    );
}

// Exercise the SHA port from the ACTUAL native fixture with the ACTUAL transfer factory.
// Only storage/clock surfaces are synthetic; no native view, network or target writes.
(async () => {
    const crypto = require("node:crypto");
    const { TextEncoder, TextDecoder } = require("node:util");
    const moduleCache = new Map();
    function actualModule(name) {
        name = name.split("/").pop();
        if (moduleCache.has(name)) return moduleCache.get(name);
        const category =
            name === "favorites-transfer" || name === "favorites-recovery"
                ? "commands"
                : "settings";
        const exports = {};
        const code = ts.transpileModule(
            fs.readFileSync(
                path.join(root, "src", category, name + ".ts"),
                "utf8"
            ),
            {
                compilerOptions: {
                    module: ts.ModuleKind.CommonJS,
                    target: ts.ScriptTarget.ES5,
                },
            }
        ).outputText;
        moduleCache.set(name, exports);
        vm.runInNewContext(code, {
            Date,
            Error,
            exports,
            Promise,
            require: actualModule,
            Uint8Array,
        });
        return exports;
    }
    const expected = (value) =>
        crypto.createHash("sha256").update(value).digest("hex");
    async function fixture() {
        let ports,
            engine,
            writes = 0,
            timer = 0;
        const timers = new Map();
        const grant = {
            compareAndSwap: () => {
                writes++;
                return "confirmed";
            },
            current: () => true,
            exclusive: (action) => action(),
            implementationVersion: 1,
            kind: "synchronous-localstorage",
            lockName: "ottplay:favorites-ledger",
            origin: "tauri://localhost",
            privateLedgerKey: "favorites-receipts.v1",
            read: () => null,
        };
        const window = {
            clearTimeout: (id) => timers.delete(id),
            nativeFixtureLoad(name) {
                const actual = actualModule(name);
                if (name !== "favorites-transfer") return actual;
                return {
                    createFavoritesTransfer(value) {
                        ports = value;
                        engine = actual.createFavoritesTransfer(value);
                        return engine;
                    },
                };
            },
            nativeStorageFacade: {
                capture: () => grant,
                raw: () => null,
                reader: () => grant,
            },
            setTimeout: (action) => {
                timers.set(++timer, action);
                return timer;
            },
            stbGetPersistedItem: () => null,
        };
        vm.runInNewContext(
            fs.readFileSync(
                path.join(
                    root,
                    "src-tauri/examples/favorites-storage-smoke/recovery.js"
                ),
                "utf8"
            ),
            {
                atob: (v) => Buffer.from(v, "base64").toString("binary"),
                btoa: (v) => Buffer.from(v, "binary").toString("base64"),
                crypto: crypto.webcrypto,
                Date,
                Error,
                Promise,
                TextDecoder,
                TextEncoder,
                Uint8Array,
                window,
            }
        );
        await window.installNativeRecovery("native-hash-test");
        return { engine, ports, writes: () => writes };
    }
    const first = await fixture();
    const unicode = "Кукутики · café · 🦊";
    assert.equal(
        await first.ports.sha256(unicode),
        expected(Buffer.from(unicode, "utf8"))
    );
    async function transfer(offset, incorrect) {
        const f = await fixture();
        const originalDecode = f.ports.base64Decode;
        if (offset)
            f.ports.base64Decode = (text) => {
                const bytes = originalDecode(text);
                const owned = new Uint8Array(bytes.length + 4);
                owned.fill(255);
                owned.set(bytes, 2);
                return owned.subarray(2, bytes.length + 2);
            };
        const scope = {
            profileBindingId: "00000000-0000-4000-8000-000000000010",
            provider: "plex",
            sourceBindingId: "00000000-0000-4000-8000-000000000011",
        };
        const bytes = new TextEncoder().encode(
            JSON.stringify({ scope, synthetic: true, title: unicode })
        );
        const digest = expected(bytes);
        const operation = crypto.randomUUID();
        const send = (params) =>
            f.engine.execute(params, {
                deadlineAt: Date.now() + 5000,
                envelope: {
                    action: "favorites_transfer",
                    expires_at: (Date.now() + 5000) / 1000,
                    id: "hash-fixture",
                    params,
                },
                runtime: "native-hash-test",
            });
        const begun = await send({
            binding_revision: "bindings-before",
            chunk_count: 1,
            document_sha256: digest,
            expected_revision: "favorites-before",
            op: "begin",
            operation_id: operation,
            persistence: "persistent",
            runtime: "native-hash-test",
            scope,
            size_bytes: bytes.length,
        });
        assert.equal(begun.error, undefined, "actual begin: " + begun.error);
        const appended = await send({
            chunk_sha256: incorrect ? "0".repeat(64) : digest,
            data_base64: Buffer.from(bytes).toString("base64"),
            offset: 0,
            op: "append",
            runtime: "native-hash-test",
            seq: 0,
            transaction_id: begun.transaction_id,
        });
        if (incorrect) assert.equal(appended.error, "hash_mismatch");
        else {
            assert.equal(
                appended.error,
                undefined,
                "actual append: " + appended.error
            );
            assert.equal(appended.received_bytes, bytes.length);
            const preview = await send({
                op: "preview",
                runtime: "native-hash-test",
                transaction_id: begun.transaction_id,
            });
            assert.equal(
                preview.error,
                undefined,
                "actual preview: " + preview.error
            );
            assert.match(preview.plan_digest, /^[a-f0-9]{64}$/);
        }
        assert.equal(
            f.writes(),
            0,
            "begin/append/preview or rejected digest must never write target/ledger"
        );
        f.engine.dispose();
    }
    await transfer(false, false);
    await transfer(true, false);
    await transfer(true, true);
    const backing = Uint8Array.from([255, 10, 20, 30, 254]);
    const offsetBytes = backing.subarray(1, 4);
    assert.equal(offsetBytes.byteOffset, 1);
    assert.equal(await first.ports.sha256(offsetBytes), expected(offsetBytes));
    assert.notEqual(await first.ports.sha256(offsetBytes), expected(backing));
    first.engine.dispose();
    console.log(
        "PASS actual native fixture SHA string/Unicode/offset bytes and actual transfer begin/append/preview; wrong digest rejected, zero writes"
    );
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
