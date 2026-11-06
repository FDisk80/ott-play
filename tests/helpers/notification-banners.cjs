const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const acorn = require("acorn");
const source = fs.readFileSync(
    path.resolve(__dirname, "../../src/ui/notification-banners.ts"),
    "utf8"
);
const code = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES5,
    },
}).outputText;
acorn.parse(code, { ecmaVersion: 5 });

module.exports = function loadNotificationBanners(globals = {}) {
    const scope = Object.assign({ exports: {} }, globals);
    vm.runInNewContext(code, scope);
    return scope.exports;
};
