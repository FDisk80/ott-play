"use strict";
const assert = require("node:assert/strict");
const runner = require("./helpers/operator-profile-fixture.cjs");
const fixture = require("./fixtures/operator/profiles-before-core.json");
for (const row of fixture.cases) {
    const expected = JSON.parse(JSON.stringify(row.expected));
    // Missing Edem credentials leaves its settings editor open instead of
    // reporting catalog completion and replacing that editor with the list.
    if (row.profile === "edem" && row.input.settings?.key === "")
        expected.callbacks = 0;
    assert.deepEqual(
        runner.run(row.profile, row.input),
        expected,
        row.profile + " " + JSON.stringify(row.input)
    );
}
console.log(
    "PASS " +
        fixture.cases.length +
        " captured named operator credential/request contracts"
);
