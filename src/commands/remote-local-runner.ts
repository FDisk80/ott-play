/** The admitted Local operation; admission and lifetime remain in the main owner. */
function runRemoteLocalMedia(
    current: any,
    error: any,
    localMessage3: any,
    observe: any,
    path: any,
    media: any,
    params: any,
    listing: any,
    localMessage1: any,
    localMessage6: any,
    deadline: any,
    row: any,
    operation: any,
    runtime: any,
    localMessage7: any,
    progressive: any,
    w: any,
    localMessage0: any,
    localSourceScan: any,
    localMessage4: any,
    text: any,
    orderLocalItems: any,
    remotePlayerInfo: any,
    finish: any,
    fail: any
): void {
    Promise.resolve()
        .then(function () {
            if (!current()) error(localMessage3);
            return observe(
                path
                    ? media.remoteSources(false, params.source, current)
                    : media.remoteSources(
                          !!params.include_paths,
                          params.path,
                          current,
                          listing ? undefined : params.source
                      )
            );
        })
        .then(function (value: any) {
            if (!path) return value;
            if (!current()) error(localMessage3);
            if (!value || !Array.isArray(value.sources)) error(localMessage1);
            if (value.sources.length > 1) error(localMessage6);
            // Canonical lookup is read-only. Re-linking an existing folder
            // starts a new scan, preventing long scans from ever completing
            // when the controller retries a timed-out play request.
            if (value.sources.length) return { source: value.sources[0] };
            return observe(
                media.remoteConnect(params.source, current, deadline)
            );
        })
        .then(function (value: any) {
            if (!current()) error(localMessage3);
            var sources = path ? [value.source] : value.sources;
            if (!Array.isArray(sources) || sources.length > 32)
                error(localMessage1);
            sources.forEach(function (source) {
                row(source);
            });
            if (listing) {
                return {
                    op: operation,
                    runtime: runtime,
                    sources: sources.map(function (source) {
                        return row(source, !!params.include_paths);
                    }),
                    state: "ready",
                    version: 1,
                };
            }
            var matches = path
                ? sources
                : sources.filter(function (source) {
                      return source.id === params.source;
                  });
            if (!matches.length)
                matches = sources.filter(function (source) {
                    return source.name === params.source;
                });
            if (!matches.length) error("source_not_found");
            if (matches.length !== 1) error(localMessage6);
            var source = matches[0];
            if (source.kind !== "folder" || source.available === false)
                error(localMessage7);
            function result(count: number, scanning = false): any {
                return {
                    accepted: true,
                    count: count,
                    op: operation,
                    playback_confirmed: false,
                    runtime: runtime,
                    shuffled: operation === "shuffle",
                    source: row(source),
                    state: "ready",
                    version: 1,
                    ...(progressive && scanning ? { scanning: true } : {}),
                    ...(params.session === true ? { session: true } : {}),
                };
            }
            if (operation === "connect") return result(0);
            function playable(catalog: any): any[] {
                var permitted = w.__ottOfflineProfiles
                    ? w.__ottOfflineProfiles.filter(catalog)
                    : catalog;
                return (permitted.items || []).filter(function (item: any) {
                    return (
                        item.sourceId === source.id &&
                        item.available !== false &&
                        item.playback?.mode !== localMessage0 &&
                        !!item.url
                    );
                });
            }
            return observe(
                media.remoteCatalog(
                    current,
                    source.id,
                    progressive
                        ? function (catalog: any) {
                              return playable(catalog).length > 0;
                          }
                        : null
                )
            ).then(function (catalog: any) {
                if (!current()) error(localMessage3);
                var scan = localSourceScan(catalog, source.id);
                if (scan && scan.state === "error") error(localMessage1);
                if (
                    catalog.cancelled ||
                    (scan
                        ? !scan.generation ||
                          (!progressive && scan.state !== "complete")
                        : catalog.scanning)
                )
                    error(localMessage4);
                if (catalog.scanError && (!scan || !scan.generation))
                    error(localMessage1);
                if (catalog.reconnectRequired) error(localMessage7);
                if (
                    !(catalog.sources || []).some(function (entry: any) {
                        return (
                            entry.id === source.id &&
                            entry.kind === "folder" &&
                            entry.available !== false
                        );
                    })
                )
                    error(localMessage7);
                var scanning = scan
                    ? scan.state !== "complete"
                    : !!catalog.scanning;
                var items = playable(catalog);
                if (!items.length)
                    error(scanning ? localMessage4 : "empty_source");
                if (items.length > 50000) error("too_many_items");
                var known: {
                    [id: string]: boolean;
                } = Object.create(null);
                items.forEach(function (item: any) {
                    if (!text(item.id, 256) || known[item.id])
                        error(localMessage1);
                    known[item.id] = true;
                });
                var seed =
                    operation === "shuffle"
                        ? Math.floor(Math.random() * 4294967295) + 1
                        : null;
                items = orderLocalItems(items, seed);
                if (!current()) error(localMessage3);
                media.remoteActivate(
                    source.id,
                    items.map(function (item: any) {
                        return item.id;
                    }),
                    catalog,
                    function () {
                        return remotePlayerInfo(w).runtime === runtime;
                    },
                    seed
                );
                return result(items.length, scanning);
            });
        })
        .then(
            function (data: any) {
                finish({ data: data, status: "ok" });
            },
            function (cause: any) {
                fail(
                    cause === "source_unavailable"
                        ? cause
                        : cause?.localMediaCode || "native_error"
                );
            }
        );
}
(window as any).__ottRemoteLocalMediaRun = runRemoteLocalMedia;
