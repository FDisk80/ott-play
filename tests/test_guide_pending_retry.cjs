/* Real guide owner, Classic adapter and close/footer bodies; no network or sleeps. */
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fixture = require("./helpers/guide-runtime-fixture.cjs");
const { sourceFunctions } = require("./test_port_vod.cjs");

const footerUi = sourceFunctions("src/ui/index.ts", [
    "closeList",
    "updateChannelInfo",
    "virtualTimeshiftProg",
]);
const results = [];
function taggedEqual(actual, expected, assertionId, message) {
    try {
        assert.equal(actual, expected, message);
    } catch (error) {
        if (error && error.code === "ERR_ASSERTION")
            error.assertionId = assertionId;
        throw error;
    }
}
function check(name, run) {
    const evidence = [];
    try {
        run((value) => evidence.push(JSON.parse(JSON.stringify(value))));
        results.push({
            name,
            observations: { events: evidence },
            passed: true,
        });
        console.log("PASS guide pending retry: " + name);
    } catch (error) {
        const detail = {};
        for (const key of [
            "name",
            "code",
            "assertionId",
            "operator",
            "actual",
            "expected",
        ])
            detail[key] = error && error[key] !== undefined ? error[key] : null;
        detail.message =
            error && error.message !== undefined
                ? String(error.message)
                : String(error);
        results.push({
            error: detail,
            name,
            observations: { events: evidence },
            passed: false,
        });
        console.error(
            "FAIL guide pending retry: " +
                name +
                ": " +
                (error && error.stack ? error.stack : detail.message)
        );
    } finally {
        console.log(
            "GUIDE_PENDING_RETRY_EVIDENCE " + JSON.stringify({ evidence, name })
        );
    }
}
function install(capacity = 10) {
    const f = fixture(),
        h = f.host,
        query = h.$;
    h.$ = (selector) => {
        const result = query(selector);
        result.toggle = () => result;
        return result;
    };
    h.__ottClassicScreenPort = { closeList() {} };
    h.cancelMediaLoad = () => {};
    h.listElement = null;
    h.isListVisible = true;
    h.listChannel = 2;
    h.time2time = String;
    h.formatProgramDateTime = String;
    h.epgCacheCapacity = capacity;
    vm.runInContext(footerUi, h);
    return f;
}
function requests(f) {
    return f.requests.map((request) => ({
        aborts: request.aborts,
        id: request.id,
    }));
}
function footer(f) {
    return f.host.document.getElementById("programm_name").textContent || "";
}
function reopen(f, onRow) {
    const h = f.host;
    // The actual showPage ownership handoff retires the preceding page/footer.
    h.__ottClassicGuide.cancelConsumers();
    h.isListVisible = true;
    for (const id of [1, 2])
        h.getCurProgData(id, () => onRow(id, h.channels[id].name));
}

check(
    "early live close retries before the inherited one-hour deadline",
    (log) => {
        const observations = [];
        for (const capacity of [0, 10]) {
            const f = install(capacity),
                h = f.host,
                start = f.now(),
                retired = [];
            h.getCurProgData(1, () => retired.push(1));
            h.getCurProgData(2, () => retired.push(2));
            f.tick();
            const initial = requests(f),
                initialRetryAt = h.channels[1].time_request;
            h.closeList();
            f.complete([f.row(undefined, undefined, "Cancelled")], 0);
            const immediate = requests(f),
                retryAt = h.channels[1].time_request,
                afterLate = footer(f),
                lateCached = h.__ottClassicGuide.peek(1);
            f.tick(start + 3599);
            const beforeDeadline = requests(f);
            f.tick(start + 3600);
            const atDeadline = requests(f);
            if (f.requests[1])
                f.complete([f.row(undefined, undefined, "Recovered")], 1);
            const observation = {
                afterLate,
                atDeadline,
                beforeDeadline,
                capacity,
                immediate,
                initial,
                initialRetryAt,
                lateCached,
                recoveredFooter: footer(f),
                retired,
                retryAt,
                start,
            };
            observations.push(observation);
            log(observation);
        }
        // Gather the baseline deadline evidence before the first expected failure.
        for (const observed of observations) {
            assert.deepEqual(observed.initial, [{ aborts: 0, id: 1 }]);
            taggedEqual(
                observed.immediate.length,
                2,
                "EPG1051_REACQUIRE_IMMEDIATE",
                "No one-hour wait on reacquire"
            );
            assert.deepEqual(observed.immediate, [
                { aborts: 1, id: 1 },
                { aborts: 0, id: 1 },
            ]);
            assert.deepEqual(observed.beforeDeadline, observed.immediate);
            assert.deepEqual(observed.atDeadline, observed.immediate);
            assert.notEqual(observed.afterLate, "Cancelled");
            assert.equal(observed.lateCached, null);
            assert.equal(observed.recoveredFooter, "Recovered");
            assert.deepEqual(observed.retired, []);
        }
    }
);

check(
    "reopening retries a queued row which never reached the transport",
    (log) => {
        for (const capacity of [0, 10]) {
            const f = install(capacity),
                h = f.host,
                retired = [],
                painted = [];
            h.getCurProgData(1, () => retired.push(1));
            h.getCurProgData(2, () => retired.push(2));
            f.tick();
            h.closeList();
            reopen(f, (id, title) => painted.push({ id, title }));
            f.complete([f.row(undefined, undefined, "Cancelled")], 0);
            log({
                capacity,
                painted,
                phase: "reopened",
                requests: requests(f),
            });
            taggedEqual(f.requests.length, 2, "EPG1051_QUEUED_REOPEN");
            assert.equal(f.requests[1].id, 1);
            f.complete([f.row(undefined, undefined, "First")], 1);
            assert.equal(f.requests.length, 3);
            assert.equal(f.requests[2].id, 2);
            f.complete([f.row(undefined, undefined, "Second")], 2);
            log({ capacity, painted, phase: "painted", requests: requests(f) });
            assert.deepEqual(painted, [
                { id: 1, title: "First" },
                { id: 2, title: "Second" },
            ]);
            assert.equal(h.channels[1].name, "First");
            assert.equal(h.channels[2].name, "Second");
            assert.deepEqual(retired, []);
        }
    }
);

check(
    "a completed empty guide retains its real negative retry deadline",
    (log) => {
        for (const rows of [null, []]) {
            const f = install(),
                h = f.host,
                start = f.now();
            h.getCurProgData(1, () => {});
            f.tick();
            f.tick(start + 17);
            const completed = f.now();
            f.complete(rows, 0);
            const retryAt = h.channels[1].time_request;
            h.closeList();
            for (let i = 0; i < 5; i++) h.updateChannelInfo(1);
            f.tick(start + 3600);
            log({
                completed,
                phase: "initial deadline",
                requests: requests(f),
                rows,
            });
            assert.deepEqual(requests(f), [{ aborts: 0, id: 1 }]);
            f.tick(completed + 3599);
            const retainedRetryAt = h.channels[1].time_request;
            log({
                completed,
                phase: "before completion deadline",
                requests: requests(f),
                retainedRetryAt,
                retryAt,
                rows,
            });
            assert.equal(retryAt, completed + 3600);
            assert.equal(retainedRetryAt, retryAt);
            assert.deepEqual(requests(f), [{ aborts: 0, id: 1 }]);
            f.tick(completed + 3600);
            log({ phase: "due", requests: requests(f), rows });
            assert.deepEqual(requests(f), [
                { aborts: 0, id: 1 },
                { aborts: 0, id: 1 },
            ]);
            f.complete([f.row(undefined, undefined, "Now available")], 1);
            assert.equal(footer(f), "Now available");
        }
    }
);

check(
    "a direct consumer keeps the shared request alive across list close",
    (log) => {
        const f = install(),
            h = f.host,
            direct = [],
            retired = [];
        h.getCurProgData(1, () => retired.push(1));
        const cancelDirect = h.getChannelEpgCached(1, (_id, rows) =>
            direct.push(rows)
        );
        f.tick();
        h.closeList();
        f.tick();
        log({ phase: "closed", requests: requests(f) });
        assert.deepEqual(requests(f), [{ aborts: 0, id: 1 }]);
        f.complete([f.row(undefined, undefined, "Shared")], 0);
        cancelDirect();
        assert.equal(direct.length, 1);
        assert.equal(direct[0][0].name, "Shared");
        assert.equal(footer(f), "Shared");
        assert.deepEqual(retired, []);
        assert.deepEqual(requests(f), [{ aborts: 0, id: 1 }]);
    }
);

check(
    "an idempotent close cannot cancel the reacquired live request",
    (log) => {
        const f = install(),
            h = f.host;
        h.getCurProgData(1, () => {});
        f.tick();
        h.closeList();
        f.tick();
        log({ phase: "first close", requests: requests(f) });
        taggedEqual(f.requests.length, 2, "EPG1051_IDEMPOTENT_REACQUIRE");
        h.closeList();
        f.tick();
        assert.deepEqual(requests(f), [
            { aborts: 1, id: 1 },
            { aborts: 0, id: 1 },
        ]);
        f.complete([f.row(undefined, undefined, "Still owned")], 1);
        assert.equal(footer(f), "Still owned");
    }
);

check(
    "warm invalidation keeps its provisional replacement immediately retryable",
    (log) => {
        const f = install(),
            h = f.host,
            retired = [];
        h.getCurProgData(1, () => retired.push(1));
        h.getCurProgData(2, () => retired.push(2));
        f.tick();
        h.invalidateEpgCache(true);
        f.tick();
        assert.equal(f.requests.length, 2);
        assert.deepEqual(requests(f), [
            { aborts: 1, id: 1 },
            { aborts: 0, id: 1 },
        ]);
        h.closeList();
        f.tick();
        f.complete([f.row(undefined, undefined, "Before warm-up")], 0);
        f.complete([f.row(undefined, undefined, "Cancelled warm-up")], 1);
        log({
            footer: footer(f),
            phase: "closed warm-up",
            requests: requests(f),
        });
        taggedEqual(f.requests.length, 3, "EPG1051_WARM_REACQUIRE");
        assert.equal(f.requests[2].id, 1);
        assert.equal(f.requests[1].aborts, 1);
        f.complete([f.row(undefined, undefined, "Warm recovery")], 2);
        assert.equal(footer(f), "Warm recovery");
        assert.deepEqual(retired, []);
        reopen(f, () => {});
        f.tick();
        assert.equal(f.requests.length, 4);
        assert.equal(f.requests[3].id, 2);
        f.complete([f.row(undefined, undefined, "Queued recovery")], 3);
        assert.equal(h.channels[2].name, "Queued recovery");
    }
);

check(
    "old-source and old-token responses cannot publish into a replacement",
    (log) => {
        for (const replacement of ["source", "row token"]) {
            const f = install(),
                h = f.host,
                retired = [];
            h.getCurProgData(1, () => retired.push(1));
            f.tick();
            h.closeList();
            if (replacement === "source") {
                h.p_pref = "provider-b";
                h.invalidateEpgCache();
            } else {
                h.channels[1] = {
                    channel_name: "Replacement station",
                    epg: "replacement-route",
                    itemId: "station:a",
                    rec: 0,
                };
            }
            h.updateChannelInfo(1);
            f.tick();
            const beforeLate = requests(f);
            f.complete([f.row(undefined, undefined, "Retired source")], 0);
            log({
                afterLate: requests(f),
                beforeLate,
                footer: footer(f),
                replacement,
            });
            assert.equal(f.requests.length, 2);
            assert.deepEqual(requests(f), beforeLate);
            assert.equal(f.requests[1].aborts, 0);
            assert.notEqual(footer(f), "Retired source");
            f.complete([f.row(undefined, undefined, "Replacement")], 1);
            assert.equal(footer(f), "Replacement");
            assert.deepEqual(retired, []);
        }
    }
);

check(
    "synchronous cancel re-entry cannot retire a replacement observer",
    (log) => {
        const f = install(),
            h = f.host,
            transports = [],
            tokens = { 1: {}, 2: {}, 3: {} },
            received = [],
            queued = [];
        const reference = (id) => ({
            channelId: "channel:" + id,
            id,
            sourceId: "pending-retry",
            token: tokens[id],
        });
        const programme = (title) => [
            {
                description: "",
                end: f.now() + 100,
                id: title,
                start: f.now() - 10,
                title,
            },
        ];
        // Retain the actual owner's completion callback, bypassing only the
        // transport adapter which would otherwise discard late callbacks first.
        const owner = h.__ottGuideService.create({
            capacity: () => 0,
            clearTimer: h.clearTimeout,
            context: () => "pending-retry",
            current: (ref) => ref.token === tokens[ref.id],
            decode: (_ref, rows) => rows || [],
            fetch(ref, done) {
                const request = { aborts: 0, done, id: ref.id };
                transports.push(request);
                return () => {
                    request.aborts++;
                    if (request.onCancel) request.onCancel();
                };
            },
            nextCount: () => 1,
            now: f.now,
            select: (rows, now, count) =>
                h.OttPlayCore.guideScheduleSelection(rows, now, count),
            timer: h.setTimeout,
        });
        const observedTransports = () =>
            transports.map(({ id, aborts }) => ({ aborts, id }));
        let cancelReplacement;
        const cancelInitial = owner.subscribe(reference(1), () => {});
        f.tick();
        transports[0].onCancel = () => {
            cancelReplacement = owner.subscribe(reference(1), (projection) => {
                if (projection.current) received.push(projection.current.title);
            });
        };
        cancelInitial();
        f.tick();
        log({ phase: "re-entered", received, requests: observedTransports() });
        taggedEqual(transports.length, 2, "EPG1051_REENTRANT_REACQUIRE");
        assert.equal(transports[1].aborts, 0);
        owner.request(reference(2), (rows) => queued.push(rows[0].title));
        transports[0].done(programme("Retired"));
        f.tick();
        log({
            phase: "late owner completion",
            received,
            requests: observedTransports(),
        });
        assert.equal(
            transports.length,
            2,
            "Late completion cannot release the new slot"
        );
        assert.deepEqual(received, []);
        assert.equal(owner.snapshot(reference(1)).current, null);
        cancelInitial();
        transports[1].done(programme("Replacement observer"));
        f.tick();
        assert.deepEqual(received, ["Replacement observer"]);
        assert.equal(transports.length, 3);
        assert.equal(transports[2].id, 2);
        transports[2].done(programme("Queued"));
        f.tick();
        assert.deepEqual(queued, ["Queued"]);
        cancelReplacement();

        const second = [],
            cancelFirst = owner.subscribe(reference(3), () => {}),
            cancelSecond = owner.subscribe(reference(3), (projection) => {
                if (projection.current) second.push(projection.current.title);
            });
        f.tick();
        cancelFirst();
        f.tick();
        log({ phase: "second live consumer", requests: observedTransports() });
        assert.equal(transports.length, 4);
        assert.equal(
            transports[3].aborts,
            0,
            "Second live subscriber keeps the fetch"
        );
        transports[3].done(programme("Second observer"));
        f.tick();
        assert.deepEqual(second, ["Second observer"]);
        cancelSecond();
        f.tick(f.now() + 3600);
        assert.equal(transports.length, 4);
    }
);

check(
    "archive and VOD close retire hidden work without a live repaint",
    (log) => {
        for (const playType of [9990, -1]) {
            const f = install(),
                h = f.host,
                retired = [];
            h.playType = playType;
            h.getCurProgData(1, () => retired.push(1));
            h.getCurProgData(2, () => retired.push(2));
            f.tick();
            h.document.getElementById("programm_name").textContent =
                "Finite playback";
            h.closeList();
            f.complete([f.row(undefined, undefined, "Cancelled")], 0);
            f.tick(f.now() + 7200);
            log({
                footer: footer(f),
                playType,
                requests: requests(f),
                retired,
            });
            assert.deepEqual(requests(f), [{ aborts: 1, id: 1 }]);
            assert.equal(footer(f), "Finite playback");
            assert.deepEqual(retired, []);
        }
    }
);

const failed = results.filter((result) => !result.passed).length;
console.log(
    "EPG_PENDING_RETRY_RESULT " +
        JSON.stringify({
            cases: results,
            failed,
            passed: results.length - failed,
        })
);
process.exitCode = failed ? 1 : 0;
