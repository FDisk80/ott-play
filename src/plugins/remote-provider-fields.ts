/** Installed on first remote access, so optional diagnostics do not enlarge startup. */
function installProviderSettingsPort(driver: any): void {
    if (driver.saveSetting) return;
    var ports = driver.settingsPort.ports;
    var revision = 0,
        admission: (() => boolean) | null = null,
        observer: ((writes: any[]) => boolean) | null = null,
        committing = false,
        committedRevision = 0,
        commit = ports.commit;
    ports.commit = function (writes, current, rollbackAllowed) {
        var admitted = admission;
        if (!Array.isArray(writes))
            writes = Object.keys(writes).map(function (key) {
                return {
                    after: writes[key],
                    before: ports.storage.get(key),
                    key: key,
                };
            });
        if (observer && !observer(writes)) return false;
        committing = true;
        try {
            var saved = commit(
                writes,
                function () {
                    return current() && (!admitted || admitted());
                },
                rollbackAllowed
            );
            if (saved) committedRevision = revision;
            return saved;
        } finally {
            committing = false;
        }
    };
    ["saveConfiguration", "saveCredentials", "saveSettings"].forEach(
        function (method) {
            var save = (driver as any)[method];
            if (typeof save !== "function") return;
            (driver as any)[method] = function (value: any) {
                if (committing) return false;
                revision++;
                return save.call(driver, value);
            };
        }
    );
    driver.settingsRevision = function () {
        return revision;
    };
    driver.saveSetting = function (method, value, current, observe) {
        if (admission || !current()) return false;
        admission = current;
        observer = observe;
        committedRevision = 0;
        try {
            var result = false;
            try {
                result = (driver as any)[method](value);
            } catch (_) {}
            return { revision: committedRevision, saved: result };
        } finally {
            admission = null;
            observer = null;
        }
    };
}
/** Provider codecs behind typed settings receipts; storage keys never come from callers. */
function createRemoteProviderFields(w: any, driver: any): any {
    var profile: any = null;
    (w.__ottProviderDriverProfiles || []).forEach(function (row: any) {
        if (row.id === driver.id) profile = row;
    });
    if (!profile || !driver.settingsPort) return null;
    installProviderSettingsPort(driver);
    var id = driver.id,
        kind = profile.kind,
        prefix = profile.prefix;
    var schema: any[] = [],
        keys: string[] = [],
        method = "saveCredentials";
    var read = w.stbGetItem,
        write = w.stbSetItem,
        remove = w.stbDelItem;
    function active(): boolean {
        return (
            w.__ottActiveProviderDriver === driver &&
            read === w.stbGetItem &&
            write === w.stbSetItem &&
            remove === w.stbDelItem
        );
    }
    function raw(): any {
        var result: any = {};
        keys.forEach(function (key) {
            result[key] = read.call(w, key);
        });
        return result;
    }
    function model(): any {
        return method === "saveConfiguration"
            ? driver.configuration()
            : method === "saveSettings"
              ? driver.settings()
              : driver.credentials();
    }
    function selected(value: any): any {
        return kind === "m3u"
            ? value.M3Us[value.active]
            : kind === "stalker" || kind === "vportal"
              ? value.portals[value.active]
              : value;
    }
    function owns(value: any, key: string): boolean {
        return !!value && Object.prototype.hasOwnProperty.call(value, key);
    }
    function entry(name: string, field: string, options?: any): void {
        options = options || {};
        var numeric = options.values
            ? typeof options.values[0] === "number"
            : options.minimum !== undefined;
        var constraints: any = numeric
            ? {
                  maximum:
                      options.maximum === undefined
                          ? Math.max.apply(Math, options.values)
                          : options.maximum,
                  minimum:
                      options.minimum === undefined
                          ? Math.min.apply(Math, options.values)
                          : options.minimum,
              }
            : { max_utf8_bytes: options.limit || 4096 };
        if (options.values) constraints.values = options.values;
        schema.push({
            descriptor: {
                access: { read: true, write: true },
                apply: options.apply || "manual",
                constraints: constraints,
                description:
                    options.description ||
                    (options.apply === "next_stream"
                        ? "Saved for the next provider stream. Current playback is not restarted."
                        : "Saved for this provider. Reload the catalogue to apply the configuration; current playback is not restarted."),
                id: name,
                scope: "provider",
                sensitive: !!options.secret,
                type: numeric ? "integer" : "string",
            },
            field: field,
            id: name,
            options: options,
            providerField: true,
            scope: "provider",
        });
    }
    function physical(key: string): string {
        return prefix + key;
    }
    if (kind === "m3u") {
        method = "saveConfiguration";
        keys = [physical("m3uArr")];
        entry("providerName", "name", { limit: 256 });
        entry("providerPlaylist", "www", { secret: true });
        entry("m3uHistoryHours", "rechours", { maximum: 8760, minimum: 0 });
        entry("m3uMediaUrl", "medUrl", { secret: true });
    } else if (kind === "stalker" || kind === "vportal") {
        method = "saveConfiguration";
        keys = [physical(kind === "stalker" ? "stalker_data" : "profiles")];
        entry("providerName", "name", { limit: 256 });
        if (kind === "stalker") {
            entry("providerServer", "portal", { secret: true });
            entry("stalkerMac", "mac", { secret: true });
        } else entry("vportalLink", "link", { secret: true });
    } else if (kind === "plex") {
        keys = [physical("cfg")];
        entry("providerServer", "server", { secret: true });
        entry("providerPassword", "password", { limit: 1024, secret: true });
        entry("plexPlayback", "mode", {
            apply: "next_stream",
            description:
                "Playback mode is saved for the next Plex stream. Current playback is not restarted.",
            values: ["auto", "original", "compatible"],
        });
    } else if (kind === "edem") {
        method = "saveSettings";
        keys = [physical("key"), physical("vpurl"), physical("list")];
        entry("edemKey", "key", { secret: true });
        entry("edemPortal", "portal", { secret: true });
        entry("edemList", "list", { values: [0, 1, 2, 3] });
    } else if (
        kind === "xtream" ||
        kind === "operator" ||
        kind === "xtream-fallback"
    ) {
        keys = [physical(kind === "xtream" ? "xtream_data" : "cfg")];
        entry("providerServer", "server", { secret: true });
        entry("providerUsername", "username", { secret: true });
        entry("providerPassword", "password", { secret: true });
        if (kind !== "xtream")
            entry("providerPlaylist", "playlist", { secret: true });
    } else if (kind === "named-playlist") {
        if (id === "tvteam") {
            keys = [physical("www")];
            entry("providerPlaylist", "playlist", { secret: true });
        } else {
            keys = [
                physical(
                    id === "1ott" ? "id" : id === "only4" ? "token" : "login"
                ),
            ];
            entry("providerUsername", "username", { secret: true });
            if (id !== "only4") {
                keys.push(physical(id === "1ott" ? "pin" : "pass"));
                entry("providerPassword", "password", { secret: true });
            } else {
                keys.push(physical("ts_hls"));
                entry("providerMode", "mode", {
                    apply: "next_stream",
                    values: [0, 1, 2],
                });
            }
        }
    } else if (kind === "catalog") {
        keys = [physical(id === "ottclub" ? "ottkey" : "key")];
        entry("providerUsername", "username", { secret: true });
        if (id !== "itv") {
            keys.push(physical(id === "ottclub" ? "ottwww" : "server"));
            entry("providerServer", "server", { secret: true });
        }
        if (id !== "ottclub") {
            keys.push(physical("mpeg"));
            entry("providerMode", "mode", {
                apply: "next_stream",
                values: id === "itv" ? [0, 1, 2] : [0, 1],
            });
        }
    } else if (kind === "playlist") {
        if (id === "antifriz") {
            keys = [physical("key"), physical("mpeg")];
            entry("providerUsername", "username", { secret: true });
            entry("providerMode", "mode", {
                apply: "next_stream",
                values: [0, 1],
            });
        } else {
            keys = [
                physical("v_list"),
                "kbc0v_list",
                "kbc1v_list",
                "kbc2v_list",
            ];
            entry("providerPlaylist", "playlist", {
                description:
                    "Selects one of three saved KBC playlist slots. Reload the catalogue to apply it.",
                values: ["0", "1", "2"],
            });
        }
    }
    if (!schema.length) return null;
    function find(name: string): any {
        for (var i = 0; i < schema.length; i++)
            if (schema[i].id === name) return schema[i];
        return null;
    }
    function valueOf(definition: any, value: any): any {
        var item = selected(value)[definition.field];
        if (definition.id === "plexPlayback")
            return ["auto", "original", "compatible"][item || 0] || "auto";
        if (definition.descriptor.type === "integer") return Number(item || 0);
        return typeof item === "string" ? item : "";
    }
    function persisted(definition: any, state: any): any {
        var exists = false,
            value: any = null;
        if (keys.length === 1 && /(?:cfg|data|Arr|profiles)$/.test(keys[0])) {
            var data: any = {};
            try {
                data = JSON.parse(state[keys[0]] || "{}");
                if (!data || typeof data !== "object" || Array.isArray(data))
                    throw new Error();
            } catch (_) {
                return {
                    exists: state[keys[0]] !== null,
                    raw: state[keys[0]],
                    valid: false,
                    value: null,
                };
            }
            var field = definition.field;
            if (kind === "m3u") data = (data.M3Us || [])[data.active || 0];
            else if (kind === "stalker" || kind === "vportal")
                data = (data.portals || [])[data.active || 0];
            else if (kind === "plex")
                field =
                    field === "server"
                        ? "address"
                        : field === "password"
                          ? "token"
                          : "playback";
            else if (kind === "operator" || kind === "xtream-fallback")
                field = (
                    {
                        password: "pass",
                        playlist: "m3u",
                        server: "server",
                        username: "user",
                    } as any
                )[field];
            exists = owns(data, field);
            value = exists ? data[field] : null;
        } else {
            value = state[keys[schema.indexOf(definition)]];
            exists = value !== null;
        }
        var rawValue = exists ? JSON.stringify(value) : null;
        if (
            definition.descriptor.type === "integer" &&
            typeof value === "string" &&
            /^-?\d+$/.test(value)
        )
            value = Number(value);
        return {
            exists: exists,
            raw: rawValue,
            valid: exists && valid(definition, value),
            value: value,
        };
    }
    function valid(definition: any, value: any): boolean {
        var d = definition.descriptor,
            c = d.constraints;
        if (d.type === "integer")
            return (
                typeof value === "number" &&
                isFinite(value) &&
                Math.floor(value) === value &&
                value >= c.minimum &&
                value <= c.maximum &&
                (!c.values || c.values.indexOf(value) !== -1)
            );
        if (
            typeof value !== "string" ||
            /[\x00-\x1f\x7f]/.test(value) ||
            (c.values && c.values.indexOf(value) === -1)
        )
            return false;
        try {
            return (
                encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x")
                    .length <= c.max_utf8_bytes
            );
        } catch (_) {
            return false;
        }
    }
    function capture(name: string): any {
        var definition = find(name),
            state = raw(),
            saved = JSON.stringify(state),
            version = driver.settingsRevision();
        var value = valueOf(definition, model()),
            stored = persisted(definition, state);
        return {
            configured: stored.exists && stored.value !== "",
            current: function () {
                return (
                    active() &&
                    driver.settingsRevision() === version &&
                    JSON.stringify(raw()) === saved
                );
            },
            raw: stored.raw,
            state: state,
            storage: {
                read: function () {
                    return persisted(definition, raw()).raw;
                },
            },
            stored: stored.value,
            valid: stored.valid,
            value: value,
            version: version,
        };
    }
    function normalize(definition: any, value: any): any {
        if (!valid(definition, value)) throw new Error("invalid_value");
        if (
            definition.id === "stalkerMac" &&
            !/^(?:[a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(value)
        )
            throw new Error("invalid_value");
        if (definition.id === "edemPortal") {
            var header = /^portal::(?:\[|%5b)key:([\s\S]*?)(?:\]|%5d)/i.exec(
                value
            );
            if (header)
                value =
                    "portal::[key:" +
                    header[1] +
                    "]" +
                    value.slice(header[0].length);
            if (value && value.indexOf("portal::[key:") !== 0)
                throw new Error("invalid_value");
        }
        if (
            definition.id === "providerPlaylist" &&
            kind === "m3u" &&
            /^portal:/i.test(value.trim())
        )
            throw new Error("invalid_value");
        if (definition.id === "providerPlaylist" && id === "tvteam")
            value = w.OttPlayCore.operatorTvteamPlaylist(value);
        if (
            id === "only4" &&
            definition.field === "username" &&
            value &&
            value.length !== 10
        )
            throw new Error("invalid_value");
        if (kind === "plex" && definition.field === "server")
            value = value.trim().replace(/\/+$/, "");
        if (kind === "plex" && definition.field === "password")
            value = value.trim();
        if (
            (id === "shara-tv" &&
                /^(username|password)$/.test(definition.field) &&
                value.length !== 8) ||
            (id === "antifriz" &&
                definition.field === "username" &&
                value.length !== 8) ||
            (id === "itv" &&
                definition.field === "username" &&
                (value.length < 10 || value.length > 12)) ||
            (id === "shura" &&
                definition.field === "username" &&
                value &&
                value.length < 8)
        )
            throw new Error("invalid_value");
        if (
            definition.id === "providerServer" &&
            value &&
            (kind === "xtream" ||
                kind === "stalker" ||
                kind === "plex" ||
                kind === "operator" ||
                kind === "xtream-fallback" ||
                id === "ottclub")
        ) {
            var address = id === "ottclub" ? "http://" + value : value;
            if (
                !/^https?:\/\//i.test(address) ||
                !w.checkProviderUrl(address) ||
                (id === "ottclub" && /[\s/\\?#@]/.test(value))
            )
                throw new Error("invalid_value");
        }
        return value;
    }
    function persist(
        next: any,
        before: any,
        current: () => boolean,
        verify: () => boolean
    ): boolean {
        if (!before.current() || !current())
            throw new Error("revision_conflict");
        var expected: any = {},
            written: any = {},
            effectFailed = false;
        keys.forEach(function (key) {
            expected[key] = before.state[key];
        });
        function observe(writes: any[]): boolean {
            if (!current()) return false;
            for (var i = 0; i < writes.length; i++) {
                var row = writes[i],
                    key =
                        (row.prefix === undefined ? prefix : row.prefix) +
                        row.key;
                if (
                    !owns(expected, key) ||
                    read.call(w, key) !== row.before ||
                    expected[key] !== row.before
                )
                    return false;
                written[key] = row.after;
            }
            return true;
        }
        function admitted(): boolean {
            if (!active() || !current()) return false;
            var state = raw();
            return keys.every(function (key) {
                return (
                    state[key] === expected[key] ||
                    (owns(written, key) && state[key] === written[key])
                );
            });
        }
        var result: any = null;
        try {
            result = driver.saveSetting(method, next, admitted, observe);
        } catch (_) {
            effectFailed = true;
        }
        Object.keys(written).forEach(function (key) {
            expected[key] = written[key];
        });
        if (
            !Object.keys(written).length ||
            JSON.stringify(raw()) !== JSON.stringify(expected) ||
            !verify()
        )
            throw new Error("storage_failed");
        if (
            !active() ||
            !current() ||
            (result &&
                result.revision &&
                result.revision !== driver.settingsRevision())
        )
            throw new Error("source_changed");
        try {
            if (driver.settingsChanged) driver.settingsChanged();
        } catch (_) {
            effectFailed = true;
        }
        if (
            !active() ||
            !current() ||
            JSON.stringify(raw()) !== JSON.stringify(expected) ||
            !verify() ||
            (result &&
                result.revision &&
                result.revision !== driver.settingsRevision())
        )
            throw new Error("source_changed");
        return effectFailed || !result || result.saved === false;
    }
    function save(
        name: string,
        requested: any,
        before: any,
        current: () => boolean
    ): any {
        var definition = find(name),
            normalized = normalize(definition, requested),
            next = model();
        if (
            kind === "plex" &&
            definition.field === "server" &&
            next.server !== normalized
        )
            delete next.folders;
        selected(next)[definition.field] =
            definition.id === "plexPlayback"
                ? ["auto", "original", "compatible"].indexOf(normalized)
                : normalized;
        var failed = persist(next, before, current, function () {
            return valueOf(definition, model()) === normalized;
        });
        return {
            capture: capture(name),
            effectFailed: failed,
            value: normalized,
        };
    }
    function folderSnapshot(): any {
        if (kind !== "plex") throw new Error("unsupported");
        var value = driver.configuration();
        if (!value) throw new Error("unsupported");
        return {
            capture: capture("providerServer"),
            items: value.folderSelection ? value.folders || [] : [],
        };
    }
    function saveFolders(
        items: any[],
        before: any,
        current: () => boolean
    ): any {
        if (kind !== "plex") throw new Error("unsupported");
        var next = driver.credentials(),
            expected = JSON.stringify(items);
        next.folders = items;
        next.folderSelection = true;
        var failed = persist(next, before, current, function () {
            return (
                driver.configuration().folderSelection === true &&
                JSON.stringify(driver.configuration().folders || []) ===
                    expected
            );
        });
        return { effectFailed: failed, snapshot: folderSnapshot() };
    }
    return {
        active: active,
        capture: capture,
        folderSnapshot: folderSnapshot,
        save: save,
        saveFolders: saveFolders,
        schema: schema,
    };
}
/** Legacy two-field setup shares the lazy provider configuration boundary. */
function saveRemotePlexFields(w: any, driver: any, params: any): any {
    var settings = params && params.settings;
    var fields = Object.keys(settings || {});
    if (
        !params ||
        params.provider !== "plex" ||
        Object.keys(params).some(function (key) {
            return key !== "provider" && key !== "settings";
        }) ||
        !settings ||
        typeof settings !== "object" ||
        Array.isArray(settings) ||
        !fields.length ||
        fields.some(function (key) {
            return (
                (key !== "server" && key !== "token") ||
                typeof settings[key] !== "string" ||
                settings[key].length > 8192
            );
        })
    )
        return "Unsupported provider settings fields.";
    if (
        fields.indexOf("token") !== -1 &&
        (settings.token.length > 1024 ||
            /[\s\u0000-\u001f\u007f]/.test(settings.token))
    )
        return "Use a Plex access token without whitespace.";
    var config = driver.credentials();
    if (settings.server !== undefined && settings.server !== config.server)
        delete (config as any).folders;
    fields.forEach(function (key) {
        config[key === "token" ? "password" : key] = settings[key];
    });
    var plex = w.__ottPlex;
    var normalized =
        plex &&
        typeof plex.normalize === "function" &&
        plex.normalize({ address: config.server, token: config.password });
    if (!normalized)
        return "Use a valid Plex server URL and access token; first setup requires both.";
    try {
        var url = new URL(normalized.address);
        if (!w.checkProviderUrl(url.href)) throw new Error();
    } catch (_) {
        return "Use a valid HTTP(S) provider URL.";
    }
    if (
        w.__ottActiveProviderDriver !== driver ||
        typeof w.loadChannels !== "function"
    )
        return "Plex settings are unavailable on this player.";
    if (driver.saveCredentials(config) === false)
        return "Could not save provider settings.";
    // Only a persisted external save supersedes pending editor/auth callbacks.
    driver.settingsChanged();
    if (w.__ottActiveProviderDriver !== driver)
        return "Plex settings are unavailable on this player.";
    w.loadChannels();
    return fields;
}
(window as any).__ottRemoteProviderFields = {
    create: createRemoteProviderFields,
    legacyPlex: saveRemotePlexFields,
};
