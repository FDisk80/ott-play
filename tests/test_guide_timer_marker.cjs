const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const fixture = require("./helpers/guide-runtime-fixture.cjs");
let count = 0;
function check(name, run) {
    run();
    count++;
    console.log("PASS guide timer marker: " + name);
}
function open(f) {
    const h = f.host;
    h.epgList(0, 0, false);
    f.tick();
    f.complete([
        f.row(f.now() + 120, f.now() + 240, "Future", "broadcast:7"),
        f.row(f.now() + 240, f.now() + 360, "Next", "broadcast:8"),
    ]);
    return h.listArray[0];
}
function marker(html) {
    return new JSDOM(html).window.document.querySelector(".ott-epg-reminder");
}
function add(f) {
    f.host.setEpgTimer();
    f.prompts.at(-1).yes();
}
check(
    "confirmed add and removal repaint the actual list with one colored accessible marker before time",
    () => {
        const f = fixture(),
            h = f.host,
            row = open(f),
            paints = [];
        h.showPage = () => paints.push(h.itemEPG(row, 0));
        assert.equal(marker(h.itemEPG(row, 0)), null);
        h.setEpgTimer();
        assert.equal(
            marker(h.itemEPG(row, 0)),
            null,
            "A prompt is not a saved timer"
        );
        f.prompts.at(-1).yes();
        assert.equal(paints.length, 1);
        const doc = new JSDOM(paints[0]).window.document,
            icon = doc.querySelector(".ott-epg-reminder");
        assert(icon, "the confirmed timer must have a visible marker");
        assert(icon.classList.contains("yellow"));
        assert.equal(icon.getAttribute("aria-label"), "Timer");
        assert.equal(icon.getAttribute("role"), "img");
        assert(
            icon.compareDocumentPosition(doc.querySelector(".ott-epg-time")) & 4
        );
        assert.equal(doc.querySelectorAll(".ott-epg-reminder").length, 1);
        assert.equal(marker(h.itemEPG(h.listArray[1], 1)), null);
        h.setEpgTimer();
        assert.equal(f.prompts.at(-1).text, "Remove timer?");
        f.prompts.at(-1).yes();
        assert.equal(paints.length, 2);
        assert.equal(marker(paints[1]), null);
    }
);
check(
    "failed durable write leaves no success marker and does not repaint",
    () => {
        const f = fixture(),
            h = f.host,
            row = open(f);
        h.loadEpgTimers();
        h.providerSetItem = () => {};
        // Reload binds the current writer; readback must reject the no-op save.
        h.loadEpgTimers();
        let paints = 0;
        h.showPage = () => paints++;
        add(f);
        assert.equal(paints, 0);
        assert.equal(marker(h.itemEPG(row, 0)), null);
    }
);
check(
    "fresh owner restores accepted timers without extra reads per rendered row",
    () => {
        const first = fixture();
        open(first);
        add(first);
        const f = fixture({ saved: Object.fromEntries(first.saved) }),
            h = f.host,
            row = open(f);
        h.loadEpgTimers();
        let reads = 0,
            writes = 0;
        h.providerGetItem = () => {
            reads++;
            throw Error("Unexpected row storage read");
        };
        h.providerSetItem = () => {
            writes++;
            throw Error("Unexpected row storage write");
        };
        for (let i = 0; i < 50; i++) assert(marker(h.itemEPG(row, i)));
        assert.equal(reads, 0);
        assert.equal(writes, 0);
    }
);
check(
    "profile, channel, programme identity and end boundary cannot leak a marker",
    () => {
        const f = fixture(),
            h = f.host,
            row = open(f);
        add(f);
        assert(marker(h.itemEPG(row, 0)));
        assert.equal(h.__ottClassicReminders.hasProgramme(2, row), false);
        assert.equal(
            h.__ottClassicReminders.hasProgramme(1, {
                ...row,
                programmeId: "other",
            }),
            false
        );
        assert.equal(
            h.__ottClassicReminders.hasProgramme(1, {
                ...row,
                time: row.time + 1,
            }),
            false
        );
        h.p_pref = "provider-b";
        assert.equal(marker(h.itemEPG(row, 0)), null);
        h.p_pref = "provider-a";
        assert(marker(h.itemEPG(row, 0)));
        h.cats.All = [2, 1];
        h.curList = [2, 1];
        assert(marker(h.itemEPG(row, 0)), "Category order is not identity");
        h.channels[9] = h.channels[1];
        delete h.channels[1];
        h.curList = [9, 2];
        h.cats.All = [9, 2];
        h.epg_ch_id = 9;
        assert(
            marker(h.itemEPG(row, 0)),
            "Transport numbering is not stable channel identity"
        );

        f.tick(row.time_to);
        assert.equal(
            marker(h.itemEPG(row, 0)),
            null,
            "Ended timers are not pending"
        );
    }
);
check(
    "legacy timer resolves to the current stable channel and can be removed normally",
    () => {
        const f = fixture({
                saved: {
                    "provider-a:epgTimers": JSON.stringify([
                        { ci: 1, n: "Future", t: 10120, te: 10240 },
                    ]),
                },
            }),
            h = f.host,
            row = open(f);
        h.loadEpgTimers();
        assert(marker(h.itemEPG(row, 0)));
        assert.equal(h.__ottClassicReminders.hasProgramme(2, row), false);
        h.setEpgTimer();
        assert.equal(f.prompts.at(-1).text, "Remove timer?");
        f.prompts.at(-1).yes();
        assert.equal(marker(h.itemEPG(row, 0)), null);
    }
);
check(
    "alphabetical, detail and optional ESM rows use the same authoritative marker",
    () => {
        const f = fixture(),
            h = f.host,
            row = open(f);
        add(f);
        h.epgListMode = 2;
        assert(marker(h.itemEPG(row, 0)));
        const doc = new JSDOM('<div id="listDetail"></div>').window.document;
        h.listDetailElement = doc.querySelector("#listDetail");
        const query = h.$;
        h.$ = (s) => {
            const x = query(s);
            x.height = (v) => (v === undefined ? 100 : x);
            return x;
        };
        h.detailEPG(1);
        const icon = h.listDetailElement.querySelector(".ott-epg-reminder");
        assert(icon);
        assert.equal(icon.parentElement.className, "ott-epg-detail-time");
        assert(marker(h.renderEpgHTML([row])));
        assert.equal(marker(h.renderEpgHTML([{ ...row, ch_id: 2 }])), null);
        h.__ottClassicReminders.dispose();
        assert.equal(marker(h.itemEPG(row, 0)), null);
    }
);
console.log("PASS " + count + " guide timer marker scenarios");
