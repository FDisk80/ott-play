/** Owned browser File references; never persists or copies media bytes. */
var droppedVideoSerial = 0;

function droppedVideoItem(w: any, file: any): any {
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
    return {
        access: "granted",
        available: true,
        directory: "",
        mime: mime,
        name: file.name,
        relativePath: null,
        size: file.size,
        source: "dropped",
    };
}

export function createDroppedVideos(
    w: any,
    files: any
): {
    catalog: any;
    sourceId: string;
    itemIds: string[];
    release: () => void;
} {
    var count = files && files.length;
    if (
        typeof count !== "number" ||
        count < 1 ||
        count > 128 ||
        Math.floor(count) !== count
    )
        throw new Error("Choose 1 to 128 supported video files");
    // Snapshot and validate the entire gesture before allocating any URL.
    var captured: any[] = [];
    var items: any[] = [];
    for (var i = 0; i < count; i++) {
        var file = files[i];
        captured.push(file);
        items.push(droppedVideoItem(w, file));
    }
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
    var itemIds: string[] = [];
    var ownedUrls: string[] = [];
    var released = false;
    function release(): void {
        if (released) return;
        released = true;
        for (var i = 0; i < ownedUrls.length; i++) {
            try {
                urls.revokeObjectURL(ownedUrls[i]);
            } catch (_) {}
        }
    }
    try {
        for (var i = 0; i < count; i++) {
            var url = urls.createObjectURL(captured[i]);
            ownedUrls.push(url);
            var itemId = id + "-item-" + (i + 1);
            itemIds.push(itemId);
            items[i].id = itemId;
            items[i].sourceId = sourceId;
            items[i].url = url;
        }
    } catch (_) {
        release();
        throw new Error("Dropped video could not be opened");
    }
    return {
        catalog: {
            available: true,
            discovered: count,
            items: items,
            persistent: false,
            phase: "complete",
            scanned: count,
            scanning: false,
            sources: [
                {
                    access: "granted",
                    available: true,
                    id: sourceId,
                    kind: "file",
                    name: items[0].name,
                },
            ],
            storage: "browser",
        },
        itemIds: itemIds,
        release: release,
        sourceId: sourceId,
    };
}

export function createDroppedVideo(
    w: any,
    file: any
): {
    catalog: any;
    sourceId: string;
    itemId: string;
    release: () => void;
} {
    var lease = createDroppedVideos(w, [file]);
    return {
        catalog: lease.catalog,
        itemId: lease.itemIds[0],
        release: lease.release,
        sourceId: lease.sourceId,
    };
}
