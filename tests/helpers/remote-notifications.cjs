const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const acorn = require("acorn");

module.exports = function load(globals = {}) {
    const source = fs.readFileSync(
        path.join(__dirname, "../../src/plugins/remote-notifications.ts"),
        "utf8"
    );
    const code = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
    acorn.parse(code, { ecmaVersion: 5 });
    const mediaCode = ts.transpileModule(
        fs.readFileSync(
            path.join(__dirname, "../../src/plugins/notification-media.ts"),
            "utf8"
        ),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }
    ).outputText;
    acorn.parse(mediaCode, { ecmaVersion: 5 });
    const media = { exports: {}, ...globals };
    vm.runInNewContext(mediaCode, media);
    const banner = require("./notification-banners.cjs")(globals);
    const context = {
        exports: {},
        require(name) {
            if (name === "./notification-media")
                return globals.notificationMedia || media.exports;
            if (name === "../ui/notification-banners") return banner;
            throw new Error("Unexpected import " + name);
        },
        ...globals,
    };
    vm.runInNewContext(code, context);
    return context.exports;
};
