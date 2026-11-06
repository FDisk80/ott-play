/** Typed remote preferences use the same source-bound draft as local editors. */
function createRemotePlayerSettings(w: any, readRuntime: () => string): any {
    var serial = 0,
        identity = "",
        busy = false;
    var driver: any = null,
        store: any = null,
        context: any = null;
    var receipts: any[] = [];
    var fields: any = null;
    var tokens = /^[A-Za-z0-9_.:-]{1,128}$/;
    var ids = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
    function token(prefix: string): string {
        return prefix + Date.now().toString(36) + ":" + ++serial;
    }
    function text(value: any, limit: number): boolean {
        if (typeof value !== "string" || /[\x00-\x1f\x7f]/.test(value))
            return false;
        try {
            return (
                encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x")
                    .length <= limit
            );
        } catch (_) {
            return false;
        }
    }
    function host(): any {
        return w.__ottPlayerSettingsHost;
    }
    function lifecycle(): any {
        return w.__ottRemoteSettingsLifecycle;
    }
    function lifecycleField(id: string): boolean {
        return /^(ottplaylang|ottplaylangmode|commandServerAddress|commandServerToken|commandServerEnabled|localCmdUrl|localHttpDeviceCode|localHttpEnabled|deviceUuid|swopBaseUrl)$/.test(
            id
        );
    }
    function extras(): any {
        return (
            w.__ottExtraSettings ||
            (w.__ottRemoteSettingsExtras &&
                w.__ottRemoteSettingsExtras.create(w))
        );
    }
    function capture(id: string): any {
        var extra = extras();
        if (
            extra &&
            extra.schema.some(function (entry: any) {
                return entry.id === id;
            })
        )
            return extra.capture(id);
        return lifecycleField(id) && lifecycle()
            ? lifecycle().capture(id)
            : store.capture(id);
    }

    function refresh(): any {
        var h = host(),
            active = w.__ottActiveProviderDriver;
        if (!h || !h.store || !Array.isArray(h.schema))
            throw new Error("unsupported");
        var config: any = null;
        try {
            config =
                active && typeof active.configuration === "function"
                    ? active.configuration()
                    : null;
        } catch (_) {}
        var selected =
            config && (active.id === "kb-team" ? config.slot : config.active);
        var profile =
            typeof selected === "number" &&
            selected >= 0 &&
            selected < 15 &&
            selected % 1 === 0
                ? selected + 1
                : null;
        var next = JSON.stringify([readRuntime(), h.source(), config]);
        if (
            !context ||
            identity !== next ||
            driver !== active ||
            store !== h.store
        ) {
            identity = next;
            if (driver !== active) fields = null;
            driver = active;
            store = h.store;
            receipts = [];
            context = {
                profile: profile,
                provider:
                    active &&
                    /^[a-z0-9][a-z0-9_./-]{0,31}$/.test(active.id) &&
                    !/\.\.|\/\/|\/$/.test(active.id)
                        ? active.id
                        : null,
                token: token("context:"),
            };
        }
        if (!fields && active && w.__ottRemoteProviderFields)
            fields = w.__ottRemoteProviderFields.create(w, active);
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
    function definition(id: string): any {
        var schema = definitions();
        for (var i = 0; i < schema.length; i++)
            if (schema[i].id === id) return schema[i];
        return null;
    }
    function definitions(): any[] {
        return host().schema.concat(
            fields ? fields.schema : [],
            extras() ? extras().schema : []
        );
    }
    function providerReady(): boolean {
        var active = w.__ottActiveProviderDriver;
        try {
            return !!(
                active &&
                (typeof active.storageKey === "function"
                    ? typeof active.storageKey("sPlayers") === "string"
                    : typeof w.providerGetItem === "function" &&
                      typeof w.providerSetItem === "function")
            );
        } catch (_) {
            return false;
        }
    }
    function describe(entry: any): any {
        if (entry.extraField) return extras().descriptor(entry.id);
        if (entry.providerField) {
            var description = JSON.parse(JSON.stringify(entry.descriptor));
            if (locked())
                description.access = {
                    read: true,
                    reason: "policy_restricted",
                    write: false,
                };
            return description;
        }
        var id = entry.id,
            rules = entry.rules || {},
            fallback = entry.defaultValue;
        var sensitive =
            /^(parentPin|commandServerToken|localHttpDeviceCode|deviceUuid|localCmdUrl|commandServerAddress|swopBaseUrl|companionEndpoint|torrentCatalogEndpoint|torrentStreamAddons)$/.test(
                id
            );
        var unavailable = entry.scope === "provider" && !providerReady();
        var requiresLifecycle = lifecycleField(id);
        var constraints: any = {};
        var type = Array.isArray(fallback)
            ? "string_array"
            : typeof fallback === "number"
              ? "integer"
              : "string";
        if (type === "integer") {
            if (rules.range) {
                constraints.minimum = rules.range[0];
                constraints.maximum = rules.range[1];
            } else constraints.minimum = 0;
            if (rules.values) constraints.values = rules.values.slice();
            if (rules.durations)
                constraints.values = [
                    5, 10, 15, 20, 30, 60, 120, 180, 240, 300, 600, 900, 1200,
                    1800, 3600,
                ];
        } else {
            constraints.max_utf8_bytes = 4096;
            if (type === "string_array") constraints.max_items = 64;
            if (rules.values) constraints.values = rules.values.slice();
        }
        if (rules.language)
            constraints.values = [""].concat(
                rules.language === "subtitle" ? ["off"] : [],
                host().languages || []
            );
        var access: any = {
            read: !sensitive && !unavailable,
            write:
                !unavailable &&
                (!requiresLifecycle || !!lifecycle()) &&
                !locked(),
        };
        if (!access.write)
            access.reason = unavailable
                ? "unsupported"
                : requiresLifecycle && !lifecycle()
                  ? "lifecycle_required"
                  : "policy_restricted";
        var result: any = {
            access: access,
            apply:
                requiresLifecycle && lifecycle()
                    ? "after_ack"
                    : /^(bufSize|players|streamMaxHeight|streamMaxBitrate|preferredAudioLanguage|preferredSubtitleLanguage|companionEndpoint)$/.test(
                            id
                        )
                      ? "next_stream"
                      : /^(hdmiSupport|autorun)$/.test(id) ||
                          entry.effects.some(function (name: string) {
                              return typeof w[name] !== "function";
                          })
                        ? "manual"
                        : "immediate",
            constraints: constraints,
            description:
                "The saved preference is used by subsequent player actions and UI updates; saving does not restart current playback.",
            id: id,
            scope: entry.scope,
            sensitive: sensitive,
            type: type,
        };
        if (!sensitive)
            result.default_value = Array.isArray(fallback)
                ? fallback.slice()
                : fallback;
        if (/^preferred(?:Audio|Subtitle)Language$/.test(id))
            result.description =
                "Used when tracks are selected for the next stream, unless that channel has an explicit track preference. Saving does not switch the current track.";
        if (id === "companionEndpoint")
            result.description =
                "Installation-only companion endpoint, configured through authenticated remote settings and excluded from portable backups. Used for the next external companion stream; the native Torrent provider uses its owned service.";
        if (id === "torrentDiscoveryMode")
            result.description =
                "Local indexers use the owned native Torznab service. Catalog mode enables optional Stremio or TMDB metadata discovery.";
        if (id === "torrentCatalogEndpoint")
            result.description =
                "Installation-only metadata addon base URL, excluded from portable backups. HTTPS is required except HTTP on literal localhost, 127.0.0.1 or [::1]. Empty uses the existing TMDB transport. Used by subsequent Torrent discovery requests; it does not enable native playback support.";
        if (id === "torrentCatalogLanguage")
            result.description =
                "Metadata language for this provider. Empty follows the interface language. Used by subsequent catalog and search requests; it does not change audio or subtitles.";
        if (id === "torrentStreamAddons")
            result.description =
                "Installation-only JSON array of up to eight stream addon manifest URLs, excluded from portable backups. HTTPS is required except HTTP on literal localhost, 127.0.0.1 or [::1]. Private configuration paths are supported; user information, query strings and fragments are rejected. An empty array disables addon stream discovery. Saving does not start playback.";
        if (result.apply === "after_ack")
            result.description =
                "Saved atomically with its companion fields, then applied after acknowledgement. Failed connection changes roll back; use the group transition to confirm the outcome.";
        if (result.apply === "manual")
            result.description =
                id === "hdmiSupport"
                    ? "Legacy HDMI preference; this build has no direct HDMI apply operation."
                    : id === "autorun"
                      ? "Legacy autorun preference; actual startup is controlled by the platform autorun configuration."
                      : "Saved preference; an immediate apply hook is unavailable on this runtime. Use the platform workflow to apply it.";
        if (id === "players") {
            result.choices = [
                { aliases: ["html5", "native"], label: "HTML5", value: 0 },
                { aliases: ["hls.js", "hls"], label: "hls.js", value: 1 },
                {
                    aliases: ["shaka", "shaka-player"],
                    label: "Shaka",
                    value: 2,
                },
                {
                    aliases: ["auto", "automatic"],
                    label: "Automatic",
                    value: 3,
                },
            ];
            result.description =
                w.ott_device === "lg/webos"
                    ? "The saved provider preference is retained; LG webOS always selects Automatic playback."
                    : "The saved playback engine preference applies to the next stream.";
        }
        if (id === "bufSize") {
            result.unit = "seconds";
            result.description =
                "1 to 120 seconds sets the buffer; 0 or a value above 120 uses automatic buffering. Applies to the next stream.";
        }
        if (/^(autorun|hdmiSupport)$/.test(id))
            result.access = { read: true, reason: "unsupported", write: false };
        if (id === "uiFontScale") result.unit = "percent";
        if (id === "uiColorConfig") {
            result.constraints.max_utf8_bytes = 2048;
            result.description =
                "Client colour overrides. Empty inherits the existing theme and colours. Otherwise use canonical version 1 JSON with supported colour roles and uppercase #RRGGBB values; arbitrary CSS is not accepted. Saved overrides are applied by the client's colour renderer.";
        }
        if (id === "interfaceMode") {
            result.choices = [
                { aliases: ["classic"], label: "Classic", value: 0 },
                { aliases: ["modern"], label: "Modern", value: 1 },
            ];
            result.description =
                "Selects this client's layout independently of provider and colour theme. Modern loads on demand; effective_value reports the active layout while loading or using the Classic fallback.";
        }
        return result;
    }
    function remember(id: string, capture: any, descriptor: any): any {
        var now = Date.now(),
            binding = refresh().token;
        receipts = receipts.filter(function (receipt) {
            return receipt.created <= now && receipt.expires > now;
        });
        while (receipts.length >= 128) receipts.shift();
        var revision = token("revision:");
        receipts.push({
            capture: capture,
            context: binding,
            created: now,
            expires: now + 120000,
            id: id,
            revision: revision,
        });
        var result: any = {
            id: id,
            revision: revision,
            storage:
                capture.raw === null
                    ? "default"
                    : capture.valid
                      ? "stored"
                      : "invalid",
        };
        if (descriptor.sensitive) {
            result.redacted = true;
            result.configured =
                typeof capture.configured === "boolean"
                    ? capture.configured
                    : capture.raw !== null && capture.raw !== "";
        } else if (
            !bounded(capture.value) ||
            (capture.valid && !bounded(capture.stored))
        ) {
            // Keep a repair revision without emitting values outside the wire budget.
            result.storage = "unavailable";
        } else {
            result.value = capture.value;
            if (capture.raw !== null && capture.valid)
                result.persisted_value = capture.stored;
            if (
                id === "notificationsEnabled" &&
                (capture.effective === 0 || capture.effective === 1)
            )
                result.effective_value = capture.effective;
            if (id === "players" && w.ott_device === "lg/webos")
                result.effective_value = 3;
            if (id === "interfaceMode" && w.__ottInterfaceModeState)
                result.effective_value = w.__ottInterfaceModeState.effective;
            if (
                id === "bufSize" &&
                (capture.value === 0 || capture.value > 120)
            )
                result.effective_value = 0;
        }
        return result;
    }
    function bounded(value: any): boolean {
        return typeof value === "number"
            ? isFinite(value) && Math.floor(value) === value
            : typeof value === "string"
              ? text(value, 4096)
              : Array.isArray(value) &&
                value.length <= 64 &&
                value.every(function (part) {
                    return text(part, 4096);
                });
    }
    function request(
        request: any,
        done: (result: any) => void,
        afterReply?: any
    ): void {
        var params = request.params || {},
            op = params.op,
            completed = false;
        var runtime =
            typeof params.runtime === "string" && tokens.test(params.runtime)
                ? params.runtime
                : readRuntime();
        function respond(result: any): void {
            if (!completed) {
                completed = true;
                done(result);
            }
        }
        function fail(reason: string): void {
            respond({
                data: {
                    error: "The player setting request could not be completed.",
                    op: op,
                    reason: reason,
                    runtime: runtime,
                    version: 1,
                },
                status: reason === "unsupported" ? "unsupported" : "rejected",
            });
        }
        function reply(data: any): void {
            data.version = 1;
            data.op = op;
            data.runtime = runtime;
            data.context = refresh();
            if (!text(JSON.stringify(data), 65536)) {
                fail("unsupported");
                return;
            }
            respond({ data: data, status: "ok" });
        }
        function savedReply(capture: any, application: any): void {
            reply({
                application: application,
                changed:
                    JSON.stringify(receipt.capture.value) !==
                    JSON.stringify(capture.value),
                persisted: true,
                setting: remember(params.id, capture, descriptor),
            });
        }
        if (busy) {
            fail("revision_conflict");
            return;
        }
        if (
            !params ||
            typeof params !== "object" ||
            Array.isArray(params) ||
            typeof params.runtime !== "string" ||
            !tokens.test(params.runtime) ||
            ["schema", "get", "set"].indexOf(op) < 0
        ) {
            fail("invalid_request");
            return;
        }
        if (params.runtime !== readRuntime()) {
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
        busy = true;
        try {
            var sourceToken = refresh().token;
            var keys = Object.keys(params).sort().join(",");
            if (op === "schema") {
                var allowed = ["op", "runtime", "limit", "cursor"];
                if (
                    Object.keys(params).some(function (key) {
                        return allowed.indexOf(key) < 0;
                    }) ||
                    (params.limit !== undefined &&
                        (typeof params.limit !== "number" ||
                            params.limit < 1 ||
                            params.limit > 20 ||
                            Math.floor(params.limit) !== params.limit))
                ) {
                    fail("invalid_request");
                    return;
                }
                var offset = 0,
                    schema = definitions();
                if (params.cursor !== undefined) {
                    if (
                        typeof params.cursor !== "string" ||
                        !tokens.test(params.cursor) ||
                        params.cursor.indexOf(sourceToken + ":") !== 0 ||
                        !/^\d+$/.test(
                            params.cursor.slice(sourceToken.length + 1)
                        )
                    ) {
                        fail("source_changed");
                        return;
                    }
                    offset = Number(
                        params.cursor.slice(sourceToken.length + 1)
                    );
                    if (offset >= schema.length) {
                        fail("invalid_request");
                        return;
                    }
                }
                var end = Math.min(
                    schema.length,
                    offset + (params.limit || 20)
                );
                var entries = schema.slice(offset, end).map(describe);
                if (refresh().token !== sourceToken) {
                    fail("source_changed");
                    return;
                }
                reply({
                    next_cursor:
                        end < schema.length ? sourceToken + ":" + end : null,
                    settings: entries,
                });
                return;
            }
            if (
                keys !==
                    (op === "get"
                        ? "id,op,runtime"
                        : "context,id,op,revision,runtime,value") ||
                typeof params.id !== "string" ||
                !ids.test(params.id)
            ) {
                fail("invalid_request");
                return;
            }
            var entry = definition(params.id);
            if (!entry) {
                fail("unknown_setting");
                return;
            }
            var descriptor = describe(entry);
            if (op === "get") {
                if (entry.scope === "provider" && !providerReady()) {
                    reply({
                        descriptor: descriptor,
                        setting: {
                            id: params.id,
                            revision: token("unavailable:"),
                            storage: "unavailable",
                        },
                    });
                    return;
                }
                var captured = entry.providerField
                    ? fields.capture(params.id)
                    : capture(params.id);
                if (refresh().token !== sourceToken) {
                    fail("source_changed");
                    return;
                }
                reply({
                    descriptor: descriptor,
                    setting: remember(params.id, captured, descriptor),
                });
                return;
            }
            if (
                typeof params.context !== "string" ||
                !tokens.test(params.context) ||
                typeof params.revision !== "string" ||
                !tokens.test(params.revision) ||
                !bounded(params.value)
            ) {
                fail("invalid_value");
                return;
            }
            if (params.context !== sourceToken) {
                fail("source_changed");
                return;
            }
            if (!descriptor.access.write) {
                fail(
                    descriptor.access.reason === "lifecycle_required"
                        ? "unsupported"
                        : descriptor.access.reason === "local_action_required"
                          ? "local_only"
                          : descriptor.access.reason
                );
                return;
            }
            var receipt: any = null;
            for (var i = 0; i < receipts.length; i++)
                if (receipts[i].revision === params.revision) {
                    receipt = receipts.splice(i, 1)[0];
                    break;
                }
            if (
                !receipt ||
                receipt.id !== params.id ||
                receipt.context !== sourceToken ||
                receipt.expires <= Date.now() ||
                receipt.created > Date.now() ||
                !receipt.capture.current() ||
                receipt.capture.storage.read() !== receipt.capture.raw
            ) {
                fail("revision_conflict");
                return;
            }
            function sourceCurrent(): boolean {
                return (
                    params.runtime === readRuntime() &&
                    refresh().token === sourceToken &&
                    !(
                        typeof request.expires_at === "number" &&
                        Date.now() >= request.expires_at * 1000
                    )
                );
            }
            function admitted(): boolean {
                return (
                    sourceCurrent() &&
                    ((entry.extraField &&
                        params.id === "notificationsEnabled") ||
                        !locked())
                );
            }
            if (entry.providerField) {
                var originalHost = host(),
                    originalDriver = driver;
                try {
                    var saved = fields.save(
                        params.id,
                        params.value,
                        receipt.capture,
                        function () {
                            return (
                                host() === originalHost &&
                                driver === originalDriver &&
                                w.__ottActiveProviderDriver ===
                                    originalDriver &&
                                params.runtime === readRuntime() &&
                                !locked() &&
                                !(
                                    typeof request.expires_at === "number" &&
                                    Date.now() >= request.expires_at * 1000
                                )
                            );
                        }
                    );
                    // A verified own write may change the configuration fingerprint.
                    // Retain its admitted token and invalidate older revisions.
                    refresh();
                    context.token = sourceToken;
                    receipts = [];
                    savedReply(
                        saved.capture,
                        saved.effectFailed
                            ? { reason: "effect_failed", state: "failed" }
                            : { reason: descriptor.apply, state: "deferred" }
                    );
                } catch (error) {
                    var reason = (error as any).message;
                    fail(
                        /^(invalid_value|revision_conflict|source_changed|storage_failed)$/.test(
                            reason
                        )
                            ? reason
                            : "storage_failed"
                    );
                }
                return;
            }
            if (entry.extraField) {
                try {
                    var extraSaved = extras().save(
                        params.id,
                        params.value,
                        receipt.capture,
                        admitted,
                        afterReply
                    );
                    savedReply(extraSaved.capture, extraSaved.application);
                } catch (error) {
                    var extraReason = (error as any).message;
                    fail(
                        /^(invalid_value|revision_conflict|source_changed|storage_failed|unsupported|local_only|policy_restricted)$/.test(
                            extraReason
                        )
                            ? extraReason
                            : "storage_failed"
                    );
                }
                return;
            }
            if (lifecycleField(params.id) && lifecycle()) {
                var applied = lifecycle().save(
                    params.id,
                    params.value,
                    receipt.capture,
                    admitted,
                    afterReply
                );
                if (applied.reason) {
                    fail(applied.reason);
                    return;
                }
                reply({
                    application: applied.application,
                    changed: applied.changed,
                    persisted: true,
                    setting: remember(params.id, applied.capture, descriptor),
                });
                return;
            }
            var draft = store.begin(true, receipt.capture);
            if (!draft.set(params.id, params.value)) {
                draft.cancel();
                fail("invalid_value");
                return;
            }
            var expected = JSON.stringify(draft.get(params.id));
            if (!draft.commit([], admitted)) {
                fail(
                    draft.errorCode() === "source_changed"
                        ? "source_changed"
                        : /^(backup_changed|concurrent_edit)$/.test(
                                draft.errorCode()
                            )
                          ? "revision_conflict"
                          : "storage_failed"
                );
                return;
            }
            if (!sourceCurrent()) {
                fail("source_changed");
                return;
            }
            var after = store.capture(params.id);
            if (
                after.raw === null ||
                !after.valid ||
                JSON.stringify(after.value) !== expected ||
                JSON.stringify(after.stored) !== expected
            ) {
                fail("storage_failed");
                return;
            }
            var application: any = {
                state:
                    descriptor.apply === "immediate" ? "completed" : "deferred",
            };
            if (descriptor.apply !== "immediate")
                application.reason = descriptor.apply;
            if (draft.error())
                application = { reason: "effect_failed", state: "failed" };
            if (params.id === "interfaceMode" && !draft.error()) {
                var view = w.__ottInterfaceModeState;
                application =
                    view && view.status === "loading"
                        ? { reason: "view_loading", state: "deferred" }
                        : view && view.effective === after.value
                          ? { state: "completed" }
                          : { reason: "effect_failed", state: "failed" };
            }
            savedReply(after, application);
        } catch (_) {
            fail("storage_failed");
        } finally {
            busy = false;
        }
    }
    return { request: request };
}
(window as any).__ottPlayerSettingsFactory = {
    create: createRemotePlayerSettings,
};
