const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const file = path.resolve(__dirname, "../../src/channels/index.ts");
const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true
);
const names = new Set([
    "isCategorySelectionList",
    "categoryRowIndex",
    "setCategoryRows",
]);
const nodes = source.statements.filter(
    (node) =>
        (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) ||
        (ts.isVariableStatement(node) &&
            node.declarationList.declarations.some(
                (item) => item.name.getText(source) === "categoryRowsProjection"
            ))
);
assert.equal(
    nodes.length,
    4,
    "Load the actual category projection state and all helpers"
);
const code = ts.transpileModule(
    nodes.map((node) => node.getText(source)).join("\n"),
    {
        compilerOptions: {
            module: ts.ModuleKind.None,
            target: ts.ScriptTarget.ES5,
        },
    }
).outputText;
module.exports = function categorySelectorRuntime(host) {
    vm.runInContext(code, vm.isContext(host) ? host : vm.createContext(host));
};
