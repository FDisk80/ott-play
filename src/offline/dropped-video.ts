/** One owned browser File reference; never persists or copies media bytes. */
var droppedVideoSerial = 0;

export function createDroppedVideo(
    w: any,
    file: any
): {
    catalog: any;
    sourceId: string;
    itemId: string;
    release: () => void;
} {
    var supported = false;
    try {
        supported =
            typeof w.File === "function" &&
            file instanceof w.File &&
            file.size > 0 &&
            isFinite(file.size) &&
            /\.(mp4|m4v|webm|mov|mkv)$/i.test(file.name) &&
            (!file.type ||
                /^video\//i.test(file.type) ||
                /^(application\/octet-stream|application\/x-matroska)$/i.test(
                    file.type
                ));
        // Match the existing browser Local rule: Matroska needs an actual
        // browser capability response; AVI has no direct-browser fallback.
        if (supported && /\.mkv$/i.test(file.name))
            supported = !!w.document
                .createElement("video")
                .canPlayType(file.type || "video/x-matroska");
    } catch (_) {
        supported = false;
    }
    if (!supported) throw new Error("Choose a supported video file");
    // Blob URLs have no extension for the playback adapter to inspect. Keep
    // specific video metadata, otherwise carry the admitted container type.
    var extension = file.name
        .substring(file.name.lastIndexOf(".") + 1)
        .toLowerCase();
    var fallbackMime: { [extension: string]: string } = {
        m4v: "video/mp4",
        mkv: "video/x-matroska",
        mov: "video/quicktime",
        mp4: "video/mp4",
        webm: "video/webm",
    };
    var mime = /^video\//i.test(file.type)
        ? file.type
        : fallbackMime[extension];
    var urls = w.URL || w.webkitURL;
    if (
        !urls ||
        typeof urls.createObjectURL !== "function" ||
        typeof urls.revokeObjectURL !== "function"
    )
        throw new Error("Dropped video is unavailable in this browser");
    // This module has one owner per page. The counter distinguishes repeated
    // drops even when names, sizes and timestamps are identical.
    if (droppedVideoSerial >= 9007199254740991)
        throw new Error("Dropped video is unavailable in this browser");
    var id = "dropped-" + (++droppedVideoSerial).toString(36);
    var sourceId = id + "-source";
    var itemId = id + "-item";
    var url: string;
    try {
        url = urls.createObjectURL(file);
    } catch (_) {
        throw new Error("Dropped video could not be opened");
    }
    var released = false;
    return {
        catalog: {
            available: true,
            discovered: 1,
            items: [
                {
                    access: "granted",
                    available: true,
                    directory: "",
                    id: itemId,
                    mime: mime,
                    name: file.name,
                    relativePath: null,
                    size: file.size,
                    source: "dropped",
                    sourceId: sourceId,
                    url: url,
                },
            ],
            persistent: false,
            phase: "complete",
            scanned: 1,
            scanning: false,
            sources: [
                {
                    access: "granted",
                    available: true,
                    id: sourceId,
                    kind: "file",
                    name: file.name,
                },
            ],
            storage: "browser",
        },
        itemId: itemId,
        release: function () {
            if (released) return;
            released = true;
            try {
                urls.revokeObjectURL(url);
            } catch (_) {}
        },
        sourceId: sourceId,
    };
}
