/** Connection changes retain a private rollback receipt until the new owner is ready. */
function createRemoteLifecycleFields(w: any, readRuntime: () => string): any {
    var groups: any = {
        command_server: [
            "commandServerAddress",
            "commandServerToken",
            "commandServerEnabled",
        ],
        language: ["ottplaylang", "ottplaylangmode"],
        local_http: ["localCmdUrl", "localHttpDeviceCode", "localHttpEnabled"],
        swop: ["swopBaseUrl", "deviceUuid"],
    };
    var serial = 0,
        receipts: any[] = [],
        context: any,
        owner: any,
        identity = "";
    var timers: any = {},
        owned: any = {};
    var tokenPattern = /^[A-Za-z0-9_.:-]{1,128}$/;
    function host(): any {
        return w.__ottRemoteLifecycleHost;
    }
    function settings(): any {
        return w.__ottPlayerSettingsHost;
    }
    function token(prefix: string): string {
        return prefix + Date.now().toString(36) + ":" + ++serial;
    }
    function same(a: any, b: any): boolean {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    function groupFor(id: string): string {
        var names = Object.keys(groups);
        for (var i = 0; i < names.length; i++)
            if (groups[names[i]].indexOf(id) >= 0) return names[i];
        return "";
    }
    function source(): string {
        return JSON.stringify([readRuntime(), settings().source()]);
    }
    function refresh(): any {
        var next = source(),
            active = w.__ottActiveProviderDriver,
            config: any;
        try {
            config = active && active.configuration && active.configuration();
        } catch (_) {}
        next += JSON.stringify(config || null);
        var selected =
            config &&
            (active && active.id === "kb-team" ? config.slot : config.active);
        if (!context || identity !== next || owner !== active) {
            identity = next;
            owner = active;
            receipts = [];
            context = {
                profile:
                    Number.isInteger(selected) && selected >= 0 && selected < 15
                        ? selected + 1
                        : null,
                provider:
                    active &&
                    /^[a-z0-9][a-z0-9_./-]{0,31}$/.test(active.id) &&
                    !/\.\.|\/\/|\/$/.test(active.id)
                        ? active.id
                        : null,
                token: token("context:"),
            };
        }
        return context;
    }
    function locked(): boolean {
        return !!(
            (w.__ottKiosk && w.__ottKiosk.enabled()) ||
            (w.__ottParental
                ? w.__ottParental.needs("settings") ||
                  w.__ottParental.needs("providers")
                : (w.sPSoptions || w.sPSprovs) &&
                  w.parentPIN !== "*" &&
                  !w.parentAccess)
        );
    }
    function tuple(group: string): any[] {
        return groups[group].map(function (id: string) {
            var c = settings().store.capture(id);
            // Legacy language/configuration UI can write durable bytes before
            // publishing the registry cache. Bind the actual saved tuple.
            if (c.valid) c.value = c.stored;
            return c;
        });
    }
    function values(captures: any[]): any {
        var result: any = {};
        captures.forEach(function (c) {
            result[c.id] = c.value;
        });
        return result;
    }
    function current(captures: any[]): boolean {
        return captures.every(function (c) {
            return c.current() && c.storage.read() === c.raw && c.current();
        });
    }
    function capture(id: string): any {
        var group = groupFor(id),
            all = tuple(group);
        var c = Object.assign({}, all[groups[group].indexOf(id)]),
            original = c.current;
        // The scalar receipt binds every companion field too.
        var checks = all.map(function (entry) {
            return {
                current: entry.current,
                raw: entry.raw,
                storage: entry.storage,
            };
        });
        c.current = function () {
            return original() && current(checks);
        };
        c.lifecycleGroup = group;
        c.lifecycleCaptures = all;
        return c;
    }
    function snapshot(c: any): any {
        var result: any = {
            id: c.id,
            storage:
                c.raw === null ? "default" : c.valid ? "stored" : "invalid",
        };
        if (
            /^(commandServerAddress|commandServerToken|localCmdUrl|localHttpDeviceCode|swopBaseUrl|deviceUuid)$/.test(
                c.id
            )
        ) {
            result.redacted = true;
            result.configured = c.raw !== null && c.raw !== "";
        } else {
            result.value = c.value;
            if (c.raw !== null && c.valid) result.persisted_value = c.stored;
        }
        return result;
    }
    function readRecord(group: string): any {
        var raw = host().journal(group).read();
        if (raw === null) return null;
        if (typeof raw !== "string" || raw.length > 32768)
            throw new Error("storage_failed");
        var record = JSON.parse(raw);
        if (
            !record ||
            record.version !== 1 ||
            typeof record.id !== "string" ||
            !tokenPattern.test(record.id) ||
            ["pending", "applied", "rolled_back", "failed"].indexOf(
                record.state
            ) < 0
        )
            throw new Error("storage_failed");
        return record;
    }
    function transition(group: string): any {
        var record = readRecord(group);
        if (!record) return { state: "idle" };
        var result: any = { state: record.state };
        if (record.state === "rolled_back" || record.state === "failed")
            result.reason =
                /^(handshake_timeout|authorization_failed|network_error|storage_failed|superseded|ack_timeout|effect_failed)$/.test(
                    record.reason
                )
                    ? record.reason
                    : "effect_failed";
        return result;
    }
    function owns(group: string, record: any): boolean {
        var saved = readRecord(group);
        return !!saved && saved.id === record.id && saved.state === "pending";
    }
    function finish(
        group: string,
        record: any,
        state: string,
        reason?: string
    ): void {
        if (!owns(group, record)) return;
        if (timers[group]) w.clearTimeout(timers[group]);
        delete timers[group];
        delete owned[group];
        var clean: any = { id: record.id, state: state, version: 1 };
        if (reason) clean.reason = reason;
        var journal = host().journal(group),
            raw = JSON.stringify(clean);
        journal.write(raw);
        if (journal.read() !== raw) throw new Error("storage_failed");
    }
    function persist(
        group: string,
        next: any,
        captures: any[],
        admitted: () => boolean,
        record?: any
    ): boolean {
        var draft = settings().store.begin(true, captures);
        if (
            !groups[group].every(function (id: string) {
                return draft.set(id, next[id]);
            })
        ) {
            draft.cancel();
            return false;
        }
        var writes: any[] = [];
        if (record) {
            var journal = host().journal(group),
                raw = JSON.stringify(record);
            if (raw.length > 32768) {
                draft.cancel();
                return false;
            }
            writes.push({
                after: raw,
                before: journal.read(),
                storage: journal,
            });
        }
        return draft.commit(writes, admitted);
    }
    function desiredCurrent(group: string, record: any): boolean {
        var captures = tuple(group);
        return (
            owns(group, record) &&
            (!owned[group] || current(owned[group])) &&
            same(values(captures), record.desired) &&
            captures.every(function (c) {
                return c.valid && same(c.stored, record.desired[c.id]);
            })
        );
    }
    function rollback(
        group: string,
        record: any,
        reason: string,
        applyOwner: boolean
    ): void {
        if (!desiredCurrent(group, record)) {
            finish(group, record, "failed", "superseded");
            return;
        }
        var captures = tuple(group);
        if (
            !persist(group, record.previous, captures, function () {
                return owns(group, record);
            })
        ) {
            finish(group, record, "failed", "storage_failed");
            return;
        }
        if (!applyOwner) {
            finish(group, record, "rolled_back", reason);
            return;
        }
        var settled = false;
        try {
            host().apply(
                group,
                record.previous,
                function (error?: string) {
                    if (settled) return;
                    settled = true;
                    // A user edit during rollback wins; do not claim that its route is ours.
                    if (!same(values(tuple(group)), record.previous))
                        finish(group, record, "failed", "superseded");
                    else
                        finish(
                            group,
                            record,
                            error ? "failed" : "rolled_back",
                            error || reason
                        );
                },
                function () {
                    return (
                        owns(group, record) &&
                        same(values(tuple(group)), record.previous)
                    );
                }
            );
        } catch (_) {
            if (!settled) finish(group, record, "failed", "effect_failed");
        }
    }
    function discard(group: string, record: any): void {
        if (
            desiredCurrent(group, record) &&
            !persist(group, record.previous, tuple(group), function () {
                return owns(group, record);
            })
        ) {
            finish(group, record, "failed", "storage_failed");
            return;
        }
        finish(group, record, "failed", "superseded");
    }
    function apply(group: string, record: any): void {
        if (!owns(group, record)) return;
        if (timers[group]) w.clearTimeout(timers[group]);
        delete timers[group];
        if (!desiredCurrent(group, record)) {
            finish(group, record, "failed", "superseded");
            return;
        }
        var settled = false;
        host().apply(
            group,
            record.desired,
            function (error?: string) {
                if (settled) return;
                settled = true;
                if (!desiredCurrent(group, record)) {
                    finish(group, record, "failed", "superseded");
                    return;
                }
                if (error === "superseded") {
                    // A newer UI dictionary load owns the renderer. Restore only
                    // our still-owned saved intent; never start another load.
                    if (group === "language")
                        persist(
                            group,
                            record.previous,
                            tuple(group),
                            function () {
                                return owns(group, record);
                            }
                        );
                    finish(group, record, "failed", error);
                } else if (error) rollback(group, record, error, true);
                else finish(group, record, "applied");
            },
            function () {
                return desiredCurrent(group, record);
            }
        );
    }
    function saveValues(
        group: string,
        patch: any,
        captures: any[],
        admitted: () => boolean,
        afterReply: any
    ): any {
        if (typeof afterReply !== "function" || !host())
            return { reason: "unsupported" };
        if (!admitted() || !current(captures))
            return { reason: "revision_conflict" };
        var priorRecord = readRecord(group);
        if (priorRecord && priorRecord.state === "pending")
            return { reason: "revision_conflict" };
        var previous = values(captures),
            next: any = {},
            keys = Object.keys(patch);
        if (
            !keys.length ||
            keys.length > groups[group].length ||
            keys.some(function (id) {
                return groups[group].indexOf(id) < 0;
            })
        )
            return { reason: "invalid_value" };
        groups[group].forEach(function (id: string) {
            next[id] = Object.prototype.hasOwnProperty.call(patch, id)
                ? patch[id]
                : previous[id];
        });
        try {
            next = host().validate(group, next, patch);
        } catch (_) {
            return { reason: "invalid_value" };
        }
        if (!next) return { reason: "invalid_value" };
        var record = {
            desired: next,
            id: token("change:"),
            previous: previous,
            state: "pending",
            version: 1,
        };
        if (!persist(group, next, captures, admitted, record))
            return { reason: "storage_failed" };
        if (!same(values(tuple(group)), next))
            return { reason: "storage_failed" };
        owned[group] = tuple(group);
        if (same(previous, next) && host().applied(group, next)) {
            finish(group, record, "applied");
            return { application: { state: "completed" }, changed: false };
        }
        // Missing ACKs do not leave a live page's saved route silently changed forever.
        timers[group] = w.setTimeout(function () {
            try {
                if (owns(group, record))
                    rollback(group, record, "ack_timeout", false);
            } catch (_) {}
        }, 120000);
        afterReply(function () {
            try {
                if (!admitted()) {
                    discard(group, record);
                    return;
                }
                apply(group, record);
            } catch (_) {
                try {
                    if (desiredCurrent(group, record))
                        rollback(group, record, "effect_failed", true);
                    else finish(group, record, "failed", "superseded");
                } catch (_rollbackError) {
                    finish(group, record, "failed", "effect_failed");
                }
            }
        });
        return {
            application: { reason: "after_ack", state: "deferred" },
            changed: !same(previous, next),
        };
    }
    function save(
        id: string,
        value: any,
        captured: any,
        admitted: () => boolean,
        afterReply: any
    ): any {
        var group = groupFor(id),
            before = values(captured.lifecycleCaptures);
        if (
            !same(before[id], value) &&
            ((group === "command_server" &&
                before.commandServerEnabled === 1 &&
                id !== "commandServerEnabled") ||
                (group === "local_http" &&
                    before.localHttpEnabled === 1 &&
                    id !== "localHttpEnabled"))
        )
            return { reason: "atomic_patch_required" };
        var patch: any = {};
        patch[id] = value;
        var result = saveValues(
            groupFor(id),
            patch,
            captured.lifecycleCaptures,
            admitted,
            afterReply
        );
        if (!result.reason) result.capture = capture(id);
        return result;
    }
    function remember(group: string, captures: any[]): string {
        var now = Date.now(),
            revision = token("revision:");
        receipts = receipts.filter(function (r) {
            return r.created <= now && r.expires > now;
        });
        while (receipts.length >= 64) receipts.shift();
        receipts.push({
            captures: captures,
            context: refresh().token,
            created: now,
            expires: now + 120000,
            group: group,
            revision: revision,
        });
        return revision;
    }
    function patch(
        request: any,
        done: (result: any) => void,
        afterReply: any
    ): void {
        var p = request.params || {},
            group = p.group,
            op = p.op;
        function fail(reason: string): void {
            done({
                data: {
                    error: "The player settings patch could not be completed.",
                    group: group,
                    op: op,
                    reason: reason,
                    runtime: p.runtime,
                    version: 1,
                },
                status: reason === "unsupported" ? "unsupported" : "rejected",
            });
        }
        try {
            if (
                (group !== "command_server" && group !== "local_http") ||
                (op !== "get" && op !== "set") ||
                typeof p.runtime !== "string" ||
                !tokenPattern.test(p.runtime) ||
                Object.keys(p).sort().join(",") !==
                    (op === "get"
                        ? "group,op,runtime"
                        : "context,group,op,revision,runtime,values")
            ) {
                fail("invalid_request");
                return;
            }
            if (p.runtime !== readRuntime()) {
                fail("runtime_changed");
                return;
            }
            if (
                typeof request.expires_at === "number" &&
                Date.now() >= request.expires_at * 1000
            ) {
                fail("source_changed");
                return;
            }
            var currentContext = refresh(),
                result: any = {},
                captures: any[];
            if (op === "set") {
                if (locked()) {
                    fail("policy_restricted");
                    return;
                }
                if (p.context !== currentContext.token) {
                    fail("source_changed");
                    return;
                }
                if (
                    !p.values ||
                    typeof p.values !== "object" ||
                    Array.isArray(p.values) ||
                    typeof p.revision !== "string" ||
                    !tokenPattern.test(p.revision)
                ) {
                    fail("invalid_value");
                    return;
                }
                var receipt: any;
                for (var i = 0; i < receipts.length; i++)
                    if (receipts[i].revision === p.revision) {
                        receipt = receipts.splice(i, 1)[0];
                        break;
                    }
                if (
                    !receipt ||
                    receipt.group !== group ||
                    receipt.context !== p.context ||
                    receipt.created > Date.now() ||
                    receipt.expires <= Date.now() ||
                    !current(receipt.captures)
                ) {
                    fail("revision_conflict");
                    return;
                }
                result = saveValues(
                    group,
                    p.values,
                    receipt.captures,
                    function () {
                        return (
                            !locked() &&
                            p.runtime === readRuntime() &&
                            refresh().token === p.context &&
                            !(
                                typeof request.expires_at === "number" &&
                                Date.now() >= request.expires_at * 1000
                            )
                        );
                    },
                    afterReply
                );
                if (result.reason) {
                    fail(result.reason);
                    return;
                }
                result.persisted = true;
            }
            captures = tuple(group);
            result.version = 1;
            result.op = op;
            result.runtime = p.runtime;
            result.group = group;
            result.context = refresh();
            result.revision = remember(group, captures);
            result.settings = captures.map(snapshot);
            result.transition = transition(group);
            done({ data: result, status: "ok" });
        } catch (_) {
            fail("storage_failed");
        }
    }
    function recover(): void {
        Object.keys(groups).forEach(function (group) {
            try {
                var record = readRecord(group);
                if (!record || record.state !== "pending") return;
                if (
                    !record.previous ||
                    !record.desired ||
                    !host().validate(group, record.previous, {}) ||
                    !same(
                        host().validate(group, record.desired, {}),
                        record.desired
                    )
                ) {
                    finish(group, record, "failed", "storage_failed");
                    return;
                }
                try {
                    if (locked()) {
                        discard(group, record);
                        return;
                    }
                    apply(group, record);
                } catch (_applyError) {
                    try {
                        rollback(group, record, "effect_failed", true);
                    } catch (_rollbackError) {
                        finish(group, record, "failed", "effect_failed");
                    }
                }
            } catch (_) {}
        });
    }
    return {
        capture: capture,
        groupFor: groupFor,
        patch: patch,
        recover: recover,
        save: save,
        transition: transition,
    };
}
(window as any).__ottRemoteLifecycleFields = {
    create: createRemoteLifecycleFields,
    restore: function (w: any, runtime: () => string): void {
        if (!w.__ottRemoteLifecycleHost)
            w.__ottRemoteLifecycleHostFactory.create(
                w,
                w.__ottRemoteLifecyclePorts
            );
        var api =
            w.__ottRemoteSettingsLifecycle ||
            (w.__ottRemoteSettingsLifecycle = createRemoteLifecycleFields(
                w,
                runtime
            ));
        api.recover();
    },
};
