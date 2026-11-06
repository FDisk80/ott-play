#!/usr/bin/env node
// Install only the exact compiler needed by the existing documentation validator.
const fs = require("node:fs");
const path = require("node:path");

function prepare(root, target) {
    const source = JSON.parse(
        fs.readFileSync(path.join(root, "package-lock.json"), "utf8")
    );
    const compiler = source.packages["node_modules/typescript"];
    if (
        !compiler ||
        !/^\d+\.\d+\.\d+$/.test(compiler.version) ||
        compiler.resolved !==
            `https://registry.npmjs.org/typescript/-/typescript-${compiler.version}.tgz` ||
        !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(compiler.integrity) ||
        compiler.dependencies ||
        compiler.optionalDependencies ||
        compiler.peerDependencies
    ) {
        throw new Error(
            "Documentation compiler requires a complete standalone TypeScript lock entry"
        );
    }
    const pkg = {
        dependencies: { typescript: compiler.version },
        name: "ottplay-documentation-validation",
        private: true,
        version: "0.0.0",
    };
    const entry = { ...compiler };
    delete entry.dev;
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(
        path.join(target, "package.json"),
        JSON.stringify(pkg, null, 2) + "\n"
    );
    fs.writeFileSync(
        path.join(target, "package-lock.json"),
        JSON.stringify(
            {
                lockfileVersion: 3,
                name: pkg.name,
                packages: { "": pkg, "node_modules/typescript": entry },
                requires: true,
                version: pkg.version,
            },
            null,
            2
        ) + "\n"
    );
}

if (require.main === module) {
    if (process.argv.length !== 3)
        throw new Error("Usage: prepare-docs-validation.cjs OUTPUT_DIRECTORY");
    prepare(path.resolve(__dirname, ".."), path.resolve(process.argv[2]));
}
module.exports = { prepare };
