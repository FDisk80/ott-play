// Manager API keys: a=cancelPlayback, b=compatibilityPlayback, c=isPlaybackUrl, d=playbackItem, e=playbackSourceUrl, f=preparePlayback
// Private factory keys: a=catalogRevision, b=last, c=playbackOwnerIdentity
// Lease record keys: a=active, b=cancelUrl, c=duration, d=id, e=lease, f=sourceUrl, g=url, h=verified, i=cancel, j=itemSnapshot, k=ownerIdentity
/** Loaded only when this local-media feature is used. */
function createLocalCompatibility(w: any, p: any): any {
    // Reuse exact protocol/error strings; no messages or wire values change.
    var localText0 = "compatibility",
        localText1 = "Local playback request cancelled",
        localText2 = "application/vnd.apple.mpegurl",
        localText3 = "Local compatibility playback could not be prepared";
    function localField(owner: any, key: string): any {
        return owner == null ? undefined : owner[key];
    }
    var compatibilityLeases: any[] = [];
    var compatibilityPending: any[] = [];
    if (w.__ottLocalMedia)
        w.__ottLocalMedia.diagnosticSource = function (url: string): any {
            // Cached identities only. Never call playbackItem (it reads saved settings).
            var catalog = p.b,
                item: any = null,
                lease: any = null;
            if (
                typeof url !== "string" ||
                !catalog ||
                catalog.cancelled ||
                catalog.reconnectRequired
            )
                return null;
            for (var i = 0; catalog.items && i < catalog.items.length; i++)
                if (catalog.items[i].url === url) {
                    item = catalog.items[i];
                    break;
                }
            if (!item) {
                for (var j = compatibilityLeases.length - 1; j >= 0; j--)
                    if (
                        compatibilityLeases[j].a &&
                        compatibilityLeases[j].h &&
                        compatibilityLeases[j].g === url
                    ) {
                        lease = compatibilityLeases[j];
                        break;
                    }
                if (lease)
                    for (
                        var k = 0;
                        catalog.items && k < catalog.items.length;
                        k++
                    ) {
                        var candidate = catalog.items[k];
                        if (
                            candidate.id === lease.d &&
                            candidate.sourceId === lease.j.sourceId &&
                            candidate.url === lease.f
                        ) {
                            item = candidate;
                            break;
                        }
                    }
            }
            if (
                !item ||
                typeof item.id !== "string" ||
                !/^[a-f0-9]{32}$/.test(item.id) ||
                typeof item.sourceId !== "string" ||
                !/^[a-f0-9]{32}$/.test(item.sourceId) ||
                !(catalog.sources || []).some(function (source: any) {
                    return source.id === item.sourceId;
                })
            )
                return null;
            return { itemId: item.id, revision: p.a, sourceId: item.sourceId };
        };

    function leaseForUrl(url: string): any {
        return compatibilityLeases
            .filter(function (entry) {
                return (
                    entry.g === url ||
                    (entry.f === url && entry.h && entry.k === p.c())
                );
            })
            .pop();
    }
    function playbackItem(url: string): any {
        var lease = leaseForUrl(url),
            catalog = p.b;
        if (lease && (!lease.h || lease.k !== p.c())) return;
        var item = catalog?.items.filter(function (entry: any) {
            return entry.url === (lease ? lease.f : url);
        })[0];
        if (!lease) return item;
        if (
            (catalog && catalog.available === false) ||
            (catalog && catalog.reconnectRequired) ||
            (catalog && catalog.scanError) ||
            (catalog &&
                lease.j.sourceId &&
                !(catalog.sources || []).some(function (source: any) {
                    return (
                        source.id === lease.j.sourceId &&
                        source.available !== false
                    );
                }))
        )
            return;
        if (item)
            return item.id === lease.d &&
                item.sourceId === lease.j.sourceId &&
                item.available !== false &&
                item.playback &&
                item.playback.mode === localText0
                ? item
                : undefined;
        // A refresh clears last and progressive prefixes can omit the playing
        // item. Only an owned, verified snapshot may bridge that incomplete view.
        if (
            !catalog ||
            (catalog.scanning &&
                !(catalog.sourceScans || []).some(function (scan: any) {
                    return (
                        scan.sourceId === lease.j.sourceId &&
                        scan.state !== "pending" &&
                        scan.state !== "scanning"
                    );
                }))
        )
            return lease.j;
    }
    function compatibilityPlayback(url: string): boolean {
        return (
            localField(localField(playbackItem(url), "playback"), "mode") ===
            localText0
        );
    }
    function postOptions(controller: any, lease?: string): any {
        var options: any = { method: "POST" };
        if (controller) options.signal = controller.signal;
        if (lease) options.headers = { "X-OTT-Playback-Lease": lease };
        return options;
    }
    function cancelLease(entry: any): void {
        if (!entry.a) return;
        entry.a = false;
        var controller = w.AbortController ? new w.AbortController() : null;
        var timer = setTimeout(function () {
            if (controller) controller.abort();
        }, 5000);
        function finished(): void {
            clearTimeout(timer);
        }
        try {
            Promise.resolve(
                w.fetch(entry.b, postOptions(controller, entry.e))
            ).then(finished, finished);
        } catch (_) {
            finished();
        }
    }
    function cancelPlayback(url?: string): void {
        compatibilityPending.slice().forEach(function (pending) {
            if (!url || pending.f === url) pending.i();
        });
        compatibilityLeases.forEach(function (entry) {
            if (!url || entry.g === url || entry.f === url) cancelLease(entry);
        });
    }
    function preparePlayback(url: string, current?: () => boolean): any {
        if (w.__ottStandby?.blocked() || (current && !current()))
            return Promise.reject(new Error(localText1));
        var item = playbackItem(url);
        if (
            !item &&
            compatibilityLeases.some(function (entry) {
                return entry.g === url || entry.f === url;
            })
        )
            return Promise.reject(new Error(localText1));
        if (
            localField(localField(item, "playback"), "mode") ===
                "unsupported" ||
            (localField(localField(item, "playback"), "mode") === localText0 &&
                localField(localField(p.b, localText0), "available") === false)
        )
            return Promise.reject(
                new Error(
                    "AVI/MKV compatibility is unavailable on this library"
                )
            );
        if (!item || localField(item.playback, "mode") !== localText0)
            return Promise.resolve(url);
        var existing = compatibilityLeases.filter(function (entry) {
            return entry.g === url && entry.a && entry.h;
        })[0];
        if (existing) return Promise.resolve(url);
        if (compatibilityPending.length >= 2)
            return Promise.reject(
                new Error("Too many local playback requests")
            );
        var capturedRevision = p.a,
            identity = p.c();
        var controller = w.AbortController ? new w.AbortController() : null;
        var stopped = false,
            settled = false,
            timer: any,
            rejectRequest: any;
        var sourceUrl = item.url;
        var pending: any = {
            f: sourceUrl,
            i: function () {
                if (stopped) return;
                stopped = true;
                if (controller) controller.abort();
                finish(new Error(localText1));
            },
        };
        function admitted(): boolean {
            return (
                !stopped &&
                (!current || current()) &&
                !w.__ottStandby?.blocked() &&
                capturedRevision === p.a &&
                identity === p.c() &&
                localField(playbackItem(sourceUrl), "id") === item.id
            );
        }
        function finish(error?: any): void {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            compatibilityPending = compatibilityPending.filter(
                function (entry) {
                    return entry !== pending;
                }
            );
            if (error) rejectRequest(error);
        }
        var result: any = new Promise<string>(function (resolve, reject) {
            rejectRequest = reject;
            timer = setTimeout(function () {
                pending.i();
            }, 35000);
            compatibilityPending.push(pending);
            try {
                if (!admitted()) throw new Error(localText1);
                var prepare = new URL(item.playback.prepareUrl, sourceUrl);
                var original = new URL(sourceUrl);
                if (
                    !/^https?:$/.test(prepare.protocol) ||
                    prepare.origin !== original.origin ||
                    !/^[a-f0-9]{32}$/.test(item.id) ||
                    !prepare.pathname.endsWith(
                        "/compat/" + item.id + "/prepare"
                    ) ||
                    item.playback.mime !== localText2 ||
                    prepare.search ||
                    prepare.hash
                )
                    throw new Error(localText3);
                var cancel = new URL("cancel", prepare);
                Promise.resolve(w.fetch(prepare.href, postOptions(controller)))
                    .then(function (response: any) {
                        if (!response.ok) throw new Error(localText3);
                        return response.json();
                    })
                    .then(function (value: any) {
                        var leaseUrl = new URL(value.url, prepare);
                        if (
                            !/^[a-f0-9]{32}$/.test(value.lease || "") ||
                            leaseUrl.origin !== prepare.origin ||
                            leaseUrl.search ||
                            leaseUrl.hash ||
                            leaseUrl.pathname !==
                                prepare.pathname.replace(
                                    /prepare$/,
                                    value.lease + "/index.m3u8"
                                )
                        )
                            throw new Error(localText3);
                        var entry = {
                            a: true,
                            b: cancel.href,
                            c: value.duration,
                            d: item.id,
                            e: value.lease,
                            f: sourceUrl,
                            g: leaseUrl.href,
                            h: false,
                            j: {
                                id: item.id,
                                playback: {
                                    mime: localText2,
                                    mode: localText0,
                                    prepareUrl: prepare.href,
                                },
                                sourceId: item.sourceId,
                                url: sourceUrl,
                            },
                            k: identity,
                        };
                        compatibilityLeases.push(entry);
                        if (compatibilityLeases.length > 32) {
                            var expired = -1;
                            for (
                                var n = 0;
                                n < compatibilityLeases.length - 1;
                                n++
                            )
                                if (
                                    !compatibilityLeases[n].a &&
                                    compatibilityLeases[n].g !==
                                        w.__ottCoreCompatibilityUrl &&
                                    compatibilityLeases[n].g !==
                                        w.__ottCorePipCompatibilityUrl
                                ) {
                                    expired = n;
                                    break;
                                }
                            if (expired >= 0)
                                compatibilityLeases.splice(expired, 1);
                            else {
                                compatibilityLeases.pop();
                                cancelLease(entry);
                                throw new Error(localText3);
                            }
                        }
                        if (!admitted() || settled) {
                            cancelLease(entry);
                            finish(new Error(localText1));
                            return;
                        }
                        if (
                            (value.mode !== "remux" &&
                                value.mode !== "transcode") ||
                            value.finite !== true ||
                            value.timeline !== "vod" ||
                            value.timeOrigin !== 0 ||
                            typeof value.duration !== "number" ||
                            !isFinite(value.duration) ||
                            value.duration <= 0 ||
                            value.mime !== localText2
                        ) {
                            cancelLease(entry);
                            throw new Error(localText3);
                        }
                        entry.h = true;
                        finish();
                        resolve(entry.g);
                    })
                    .catch(function () {
                        finish(new Error(localText3));
                    });
            } catch (_) {
                finish(new Error(localText3));
            }
        });
        result.cancel = pending.i;
        return result;
    }
    return {
        a: cancelPlayback,
        b: compatibilityPlayback,
        c: function (url: string) {
            return compatibilityLeases.some(function (entry: any) {
                return (
                    entry.h &&
                    entry.g === url &&
                    localField(playbackItem(url), "id") === entry.d
                );
            });
        },
        d: playbackItem,
        e: function (url: string) {
            return localField(playbackItem(url), "url") || url;
        },
        f: preparePlayback,
    };
}
(window as any).__ottLocalCompatibilityFactory = createLocalCompatibility;
