/** Visible artwork only. HTTP posters need a native/local bridge on HTTPS pages. */
function createModernArtwork(w: any) {
    var limit = 4 * 1024 * 1024,
        cacheLimit = 8 * 1024 * 1024,
        generation = 0,
        active = 0,
        bindings: any[] = [],
        requests: any[] = [],
        cache: any[] = [],
        cacheBytes = 0;

    function nativeApi(): any {
        var api = w.__TAURI__?.core || w.__TAURI_INTERNALS__;
        return typeof api?.invoke === "function" ? api : null;
    }
    function hosted(url: URL): string {
        var deployment = w.__OTTPLAY_HOSTED__,
            routes = deployment?.artwork?.routes;
        if (deployment?.version !== 1 || !Array.isArray(routes)) return "";
        var selected = "";
        for (var i = 0; i < routes.length; i++) {
            var route = routes[i];
            try {
                var upstream = new w.URL(route.upstream);
                if (
                    upstream.username ||
                    upstream.password ||
                    upstream.search ||
                    upstream.hash ||
                    !/^https?:$/.test(upstream.protocol) ||
                    upstream.pathname.slice(-1) !== "/" ||
                    upstream.pathname === "/" ||
                    upstream.origin !== url.origin ||
                    url.pathname.indexOf(upstream.pathname) !== 0
                )
                    continue;
                var suffix = url.pathname.slice(upstream.pathname.length);
                // Hosted routes are explicit image directories, never arbitrary URL relays.
                if (
                    selected ||
                    url.search ||
                    !/^[a-z0-9][a-z0-9_.-]*\.(?:png|jpe?g|gif|webp)$/i.test(
                        suffix
                    ) ||
                    suffix.indexOf("..") !== -1 ||
                    typeof route.path !== "string" ||
                    !/^\/vportal\/artwork\/[a-z0-9-]+(?:\/[a-z0-9-]+)+\/$/.test(
                        route.path
                    )
                )
                    return "";
                selected = route.path + suffix;
            } catch (_error) {}
        }
        return selected;
    }
    function route(source: string): any {
        if (
            !source ||
            source.length > 4096 ||
            /[\u0000-\u001f\u007f]/.test(source)
        )
            return null;
        if (
            /^(blob:|data:image\/(?:png|jpe?g|webp|gif|avif|svg\+xml);)/i.test(
                source
            )
        )
            return { kind: "direct", url: source };
        try {
            var url = new w.URL(source, w.location.href);
            if (
                !/^https?:$/.test(url.protocol) ||
                url.username ||
                url.password ||
                url.hash
            )
                return null;
            if (url.protocol === "https:")
                return { kind: "direct", url: url.href };
            var native = nativeApi();
            if (native) return { kind: "native", url: url.href };
            if (
                w.location.protocol === "http:" ||
                w.location.protocol === "capacitor:" ||
                w.Capacitor?.isNativePlatform?.() === true
            )
                return { kind: "direct", url: url.href };
            var mapped = hosted(url);
            if (mapped) return { kind: "direct", url: mapped };
            if (
                !w.__OTTPLAY_HOSTED__ &&
                w.location.protocol === "https:" &&
                /^(localhost|127\.0\.0\.1|\[::1\])$/.test(w.location.hostname)
            )
                return { kind: "server", url: url.href };
        } catch (_error) {}
        return null;
    }
    function revoke(binding: any): void {
        if (binding.objectUrl) w.URL.revokeObjectURL(binding.objectUrl);
        binding.objectUrl = "";
    }
    function current(binding: any): boolean {
        return (
            binding.generation === generation &&
            binding.image.__ottArtworkBinding === binding &&
            w.document.documentElement.contains(binding.image)
        );
    }
    function retire(binding: any): void {
        revoke(binding);
        if (binding.image.__ottArtworkBinding === binding) {
            binding.image.onload = binding.image.onerror = null;
            binding.image.removeAttribute("src");
            delete binding.image.__ottArtworkBinding;
        }
        binding.generation = -1;
    }
    function prune(): void {
        bindings = bindings.filter(function (binding) {
            if (current(binding)) return true;
            retire(binding);
            return false;
        });
        requests.forEach(function (request) {
            request.waiters = request.waiters.filter(current);
            if (!request.waiters.length && request.abort && !request.aborted) {
                request.aborted = true;
                request.abort();
            }
        });
        requests = requests.filter(function (request) {
            return request.running || request.waiters.length;
        });
    }
    function failed(binding: any): void {
        if (!current(binding)) return;
        revoke(binding);
        binding.image.removeAttribute("src");
        // Explicit style also wins over theme rules such as img { display:block }.
        binding.image.style.display = "none";
        binding.image.onload = binding.image.onerror = null;
    }
    function display(binding: any, value: string, objectUrl = false): void {
        if (!current(binding)) return;
        var image = binding.image;
        if (objectUrl) binding.objectUrl = value;
        image.onerror = function () {
            failed(binding);
        };
        image.onload = function () {
            if (!current(binding)) return;
            image.style.display = "";
            revoke(binding);
        };
        image.src = value;
    }
    function remember(url: string, blob: Blob): void {
        while (
            cache.length &&
            (cache.length >= 16 || cacheBytes + blob.size > cacheLimit)
        ) {
            cacheBytes -= cache.shift().blob.size;
        }
        cache.push({ blob: blob, url: url });
        cacheBytes += blob.size;
    }
    function fromNative(result: any): Blob {
        if (
            !/^(image\/jpeg|image\/png|image\/gif|image\/webp)$/.test(
                result?.contentType
            ) ||
            typeof result.bodyBase64 !== "string" ||
            result.bodyBase64.length > Math.ceil(limit / 3) * 4 ||
            !/^[a-z0-9+/]+={0,2}$/i.test(result.bodyBase64)
        )
            throw new Error("Invalid artwork response");
        var binary = w.atob(result.bodyBase64);
        if (!binary.length || binary.length > limit)
            throw new Error("Artwork size limit");
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new w.Blob([bytes], { type: result.contentType });
    }
    function fetchBlob(request: any): Promise<Blob> {
        if (request.kind === "native")
            return Promise.resolve()
                .then(function () {
                    return nativeApi().invoke("artwork_fetch", {
                        url: request.url,
                    });
                })
                .then(fromNative);
        return new Promise(function (resolve, reject) {
            var xhr = new w.XMLHttpRequest();
            xhr.open("POST", "/artwork", true);
            xhr.timeout = 10000;
            xhr.responseType = "blob";
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onload = function () {
                var blob = xhr.response;
                if (
                    xhr.status !== 200 ||
                    !blob ||
                    !blob.size ||
                    blob.size > limit ||
                    !/^(image\/jpeg|image\/png|image\/gif|image\/webp)$/.test(
                        blob.type
                    )
                )
                    reject(new Error("Invalid artwork response"));
                else resolve(blob);
            };
            xhr.onerror =
                xhr.ontimeout =
                xhr.onabort =
                    function () {
                        reject(new Error("Artwork unavailable"));
                    };
            request.abort = function () {
                xhr.abort();
            };
            xhr.send(JSON.stringify({ url: request.url }));
        });
    }
    function pump(): void {
        prune();
        for (var i = 0; i < requests.length && active < 4; i++) {
            var request = requests[i];
            if (request.running || !request.waiters.length) continue;
            request.running = true;
            active++;
            (function (pending) {
                function finish(): void {
                    active--;
                    requests = requests.filter(function (item) {
                        return item !== pending;
                    });
                    pump();
                }
                fetchBlob(pending)
                    .then(
                        function (blob) {
                            if (
                                pending.generation === generation &&
                                pending.waiters.some(current)
                            ) {
                                remember(pending.url, blob);
                                pending.waiters.forEach(function (binding) {
                                    if (current(binding))
                                        display(
                                            binding,
                                            w.URL.createObjectURL(blob),
                                            true
                                        );
                                });
                            }
                        },
                        function () {
                            pending.waiters.forEach(failed);
                        }
                    )
                    .then(finish, function () {
                        pending.waiters.forEach(failed);
                        finish();
                    });
            })(request);
        }
        requests = requests.filter(function (request) {
            return request.running || request.waiters.length;
        });
    }
    function bind(image: any, source: string): void {
        var previous = image.__ottArtworkBinding;
        if (previous && current(previous) && previous.source === source) return;
        if (previous) retire(previous);
        var binding = {
            generation: generation,
            image: image,
            objectUrl: "",
            source: source,
        };
        image.__ottArtworkBinding = binding;
        // The caller already windows the DOM. Hidden lazy images otherwise
        // never load, so their load handler could never reveal the artwork.
        image.loading = "eager";
        image.style.display = "none";
        bindings.push(binding);
        var selected = route(source);
        if (!selected) {
            failed(binding);
            return;
        }
        if (selected.kind === "direct") {
            display(binding, selected.url);
            return;
        }
        for (var i = 0; i < cache.length; i++) {
            if (cache[i].url !== selected.url) continue;
            var hit = cache.splice(i, 1)[0];
            cache.push(hit);
            display(binding, w.URL.createObjectURL(hit.blob), true);
            return;
        }
        for (var j = 0; j < requests.length; j++) {
            var pending = requests[j];
            if (
                !pending.aborted &&
                pending.generation === generation &&
                pending.url === selected.url
            ) {
                pending.waiters.push(binding);
                pump();
                return;
            }
        }
        prune();
        if (requests.length >= 64) {
            failed(binding);
            return;
        }
        requests.push({
            generation: generation,
            kind: selected.kind,
            url: selected.url,
            waiters: [binding],
        });
        pump();
    }
    function reset(): void {
        generation++;
        bindings.forEach(retire);
        bindings = [];
        cache = [];
        cacheBytes = 0;
        prune();
    }
    return {
        bind: bind,
        decorate: function (container: HTMLElement): void {
            prune();
            var images = container.querySelectorAll("img[data-modern-artwork]");
            for (var i = 0; i < images.length; i++)
                bind(
                    images[i],
                    images[i].getAttribute("data-modern-artwork") || ""
                );
        },
        prune: prune,
        reset: reset,
    };
}
(window as any).__ottModernArtworkFactory = createModernArtwork;
