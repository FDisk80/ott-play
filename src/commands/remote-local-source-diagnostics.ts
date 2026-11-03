/** Passive DOM/native identity comparison. Never opens or initializes a library. */
function localSourceDiagnostics(w: any, runtime: () => string): Promise<any> {
    const MAX = 9007199254740991;
    const CODECS = {
        h264: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        hevc: 'video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"',
    };
    function integer(value: any): number | null {
        return typeof value === "number" &&
            isFinite(value) &&
            value >= 0 &&
            value <= MAX &&
            Math.floor(value) === value
            ? value
            : null;
    }
    function opaque(value: any): boolean {
        return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
    }
    function unknown(): any {
        return {
            endpointMatch: "unknown",
            itemId: null,
            kind: "unavailable",
            sourceId: null,
        };
    }
    function read(fn: () => any): any {
        try {
            return fn();
        } catch (_) {
            return null;
        }
    }
    function url(node: any, key: string): string | null {
        const value = read(() => node && node[key]);
        return typeof value === "string" && value.length <= 8192 ? value : null;
    }
    function capture(w: any, runtime: () => string): any {
        const node = read(() => w.document.getElementById("video"));
        const backend = read(
            () => w.__ottCoreBackendPeek && w.__ottCoreBackendPeek()
        );
        const handle = read(() => backend && backend.current("main"));
        const media = read(
            () => handle && handle.diagnosticMedia && handle.diagnosticMedia()
        );
        const playback = read(
            () => w.__ottClassicPlayback && w.__ottClassicPlayback.snapshot()
        );
        const attempt = read(
            () =>
                handle && handle.diagnosticAttempt && handle.diagnosticAttempt()
        );
        const current = url(node, "currentSrc"),
            requested = url(node, "src");
        const local = w.__ottLocalMedia;
        return {
            attachment: integer(attempt && attempt.attachment),
            backend,
            current,
            currentItem: read(() => local && local.diagnosticSource(current)),
            driver: w.__ottActiveProviderDriver,
            generation: integer(playback && playback.generation),
            handle,
            handleId: integer(handle && handle.id),
            hls: media && media.hls,
            local,
            node,
            ownedNode: media && media.media,
            ownerGeneration: integer(media && media.generation),
            requested,
            requestedItem: read(
                () => local && local.diagnosticSource(requested)
            ),
            runtime: read(runtime),
        };
    }
    function same(a: any, b: any): boolean {
        return (
            [
                "runtime",
                "node",
                "backend",
                "handle",
                "local",
                "driver",
                "generation",
                "ownerGeneration",
                "ownedNode",
                "handleId",
                "hls",
                "attachment",
                "current",
                "requested",
            ].every((key) => a[key] === b[key]) &&
            JSON.stringify(a.currentItem) === JSON.stringify(b.currentItem) &&
            JSON.stringify(a.requestedItem) === JSON.stringify(b.requestedItem)
        );
    }
    function codec(node: any, key: "h264" | "hevc"): string | null {
        const result = read(() => node && node.canPlayType(CODECS[key]));
        return result === "" || result === "maybe" || result === "probably"
            ? result
            : null;
    }
    function fallback(raw: string | null): any {
        return raw === null || /^https?:/i.test(raw)
            ? unknown()
            : {
                  endpointMatch: "not_applicable",
                  itemId: null,
                  kind:
                      raw === ""
                          ? "empty"
                          : raw.indexOf("blob:") === 0
                            ? "blob"
                            : "other",
                  sourceId: null,
              };
    }
    function descriptor(value: any, raw: string | null, item: any): any {
        if (
            !value ||
            typeof value !== "object" ||
            Object.keys(value).sort().join(",") !== "endpointMatch,itemId,kind"
        )
            return fallback(raw);
        const local = value.kind === "direct" || value.kind === "compatibility";
        if (
            local
                ? ["match", "mismatch", "unknown"].indexOf(
                      value.endpointMatch
                  ) < 0
                : value.kind === "unavailable"
                  ? value.endpointMatch !== "unknown"
                  : ["empty", "blob", "other"].indexOf(value.kind) < 0 ||
                    value.endpointMatch !== "not_applicable"
        )
            return unknown();
        const result = {
            endpointMatch: value.endpointMatch,
            itemId: null,
            kind: value.kind,
            sourceId: null,
        } as any;
        if (
            local &&
            value.endpointMatch === "match" &&
            item &&
            opaque(value.itemId) &&
            item.itemId === value.itemId &&
            opaque(item.sourceId)
        ) {
            result.itemId = item.itemId;
            result.sourceId = item.sourceId;
        }
        return result;
    }

    const before = capture(w, runtime);
    const result: any = {
        capturedAt: Date.now(),
        codecs: {
            h264: codec(before.node, "h264"),
            hevc: codec(before.node, "hevc"),
        },
        consistent: true,
        currentSource: fallback(before.current),
        generation: before.generation,
        handleId: before.handleId,
        mediaErrorCode: null,
        requestedSource: fallback(before.requested),
        runtime: before.runtime,
        version: 1,
    };
    const code = integer(
        read(() => before.node && before.node.error && before.node.error.code)
    );
    if (code !== null && code >= 1 && code <= 4) result.mediaErrorCode = code;
    function finish(native: any): any {
        const after = capture(w, runtime);
        const hasSource = !!(before.current || before.requested);
        if (
            !same(before, after) ||
            (before.node && before.node !== before.ownedNode) ||
            (hasSource &&
                (before.generation === null ||
                    before.ownerGeneration !== before.generation ||
                    before.handleId === null ||
                    before.attachment === null))
        ) {
            result.consistent = false;
            result.generation = result.handleId = result.mediaErrorCode = null;
            result.codecs = { h264: null, hevc: null };
            result.currentSource = unknown();
            result.requestedSource = unknown();
        } else if (native && native.version === 1) {
            result.currentSource = descriptor(
                native.currentSource,
                before.current,
                before.currentItem
            );
            result.requestedSource = descriptor(
                native.requestedSource,
                before.requested,
                before.requestedItem
            );
        }
        return result;
    }
    if (
        !(w.__TAURI__ || w.__TAURI_INTERNALS__) ||
        w.__ottLocalSourceDiagnosticPending
    )
        return Promise.resolve(finish(null));
    w.__ottLocalSourceDiagnosticPending = true;
    return new Promise((resolve) => {
        let settled = false;
        const timer = w.setTimeout(() => complete(null), 250);
        function complete(value: any): void {
            if (settled) return;
            settled = true;
            w.clearTimeout(timer);
            resolve(finish(value));
        }
        let pending: any;
        try {
            const bridge = w.__TAURI__ && (w.__TAURI__.core || w.__TAURI__);
            pending = bridge.invoke("local_source_diagnostics", {
                currentSource: before.current,
                requestedSource: before.requested,
            });
        } catch (_) {
            w.__ottLocalSourceDiagnosticPending = false;
            complete(null);
            return;
        }
        Promise.resolve(pending).then(
            (value) => {
                w.__ottLocalSourceDiagnosticPending = false;
                complete(value);
            },
            () => {
                w.__ottLocalSourceDiagnosticPending = false;
                complete(null);
            }
        );
    });
}
(window as any).__ottLocalSourceDiagnostics = function (
    w: any,
    runtime: () => string,
    result?: any,
    reply?: (value: any) => void
): any {
    var pending = localSourceDiagnostics(w, runtime);
    if (!reply) return pending;
    var cancelled = false;
    pending.then(
        function (value) {
            if (!cancelled) {
                result.local_source_diagnostics = value;
                reply!(result);
            }
        },
        function () {
            if (!cancelled) reply!(result);
        }
    );
    return function () {
        cancelled = true;
    };
};
