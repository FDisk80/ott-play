/** Current playback details, independent of the last browsed catalogue row. */
function showModernPlaybackInfo(
    host: any = window,
    onClose?: () => void
): boolean {
    var doc = host.document as Document;
    var port = host.__ottClassicScreenPort;
    var dialog = doc.getElementById("dialogbox");
    if (
        !dialog ||
        !port ||
        host.dialogBoxKeyHandler ||
        host.__ottKiosk?.enabled?.() ||
        host.__ottKiosk?.locked?.() ||
        host.__ottKiosk?.strict?.()
    )
        return false;
    function field(id: string): string {
        return (doc.getElementById(id)?.textContent || "").trim();
    }
    var title = field("programm_name") || field("channel_name");
    var description = playbackDescriptionText(
        doc.getElementById("programm_descr")
    );
    if (!title && !description) return false;
    var card = doc.createElement("section");
    card.className = "playback-info-card";
    card.setAttribute("aria-labelledby", "playbackInfoTitle");
    var sourceImage = doc.querySelector(
        "#programm_descr img"
    ) as HTMLImageElement;
    if (sourceImage?.getAttribute("src")) {
        var image = doc.createElement("img");
        image.className = "playback-info-art";
        image.src = sourceImage.currentSrc || sourceImage.src;
        image.alt = "";
        image.onload = function (): void {
            image.removeAttribute("hidden");
        };
        image.onerror = function (): void {
            image.hidden = true;
        };
        card.appendChild(image);
    } else {
        // The shared guide renders artwork as a sanitized CSS thumbnail,
        // whereas some media providers supply an img. Preserve either form.
        var thumbnail = doc.querySelector(
            "#programm_descr .img"
        ) as HTMLElement;
        var background = thumbnail?.style.backgroundImage;
        if (background && background !== "none") {
            var artwork = doc.createElement("div");
            artwork.className = "playback-info-art playback-info-thumbnail";
            artwork.setAttribute("aria-hidden", "true");
            artwork.style.backgroundImage = background;
            card.appendChild(artwork);
        }
    }
    var copy = doc.createElement("div");
    copy.className = "playback-info-copy";
    copy.tabIndex = 0;
    var heading = doc.createElement("h2");
    heading.id = "playbackInfoTitle";
    heading.textContent = title;
    copy.appendChild(heading);
    var paragraph = doc.createElement("p");
    paragraph.textContent = description;
    copy.appendChild(paragraph);
    card.appendChild(copy);
    var close = doc.createElement("button");
    close.type = "button";
    close.tabIndex = 0;
    close.className = "playback-info-close";
    close.textContent =
        typeof host._ === "function" ? host._("Close") : "Close";
    var actions = doc.createElement("div");
    actions.className = "playback-info-actions";
    var beginContext: any = null;
    function canBegin(): boolean {
        if (
            host.__ottKiosk?.enabled?.() ||
            host.__ottKiosk?.locked?.() ||
            host.__ottKiosk?.strict?.() ||
            typeof host.shiftArchive !== "function" ||
            typeof host.OttPlayCore?.playbackSeekPlan !== "function"
        )
            return false;
        try {
            if (beginContext && !beginContext.isCurrent()) return false;
            var context =
                beginContext || host.__ottClassicPlayback?.context?.();
            if (!context?.isCurrent?.() || !context.previewOffset) return false;
            var observation = context.previewOffset(0);
            if (!observation || !context.isCurrent()) return false;
            var plan = host.OttPlayCore.playbackSeekPlan(observation.target, {
                ...observation,
                intent: "begin",
            });
            if (!plan || !/^(seek|open-archive)$/.test(plan.action))
                return false;
            beginContext = context;
            return true;
        } catch (_) {
            return false;
        }
    }
    var restart: HTMLButtonElement | null = null;
    if (canBegin()) {
        restart = doc.createElement("button");
        restart.type = "button";
        restart.tabIndex = 0;
        restart.className = "playback-info-restart";
        restart.textContent =
            typeof host._ === "function"
                ? host._("To begining")
                : "To beginning";
        actions.appendChild(restart);
    }
    actions.appendChild(close);
    card.appendChild(actions);
    dialog.textContent = "";
    dialog.appendChild(card);
    // Use the shared visibility boundary so centering, input ownership and
    // accessibility receive the same notification as other product dialogs.
    if (typeof host.$ === "function") host.$(dialog).show();
    else dialog.style.display = "block";
    var keys = host.keys || {};
    var restartRequested = false;
    var handler = port.setOwnedCallback(
        "dialog",
        function (key: number): boolean {
            if (key === keys.RIGHT) {
                (restart || close).focus();
                return true;
            }
            if (key === keys.LEFT) {
                copy.focus();
                return true;
            }
            if (key === keys.UP || key === keys.DOWN) {
                if (actions.contains(doc.activeElement)) {
                    (key === keys.UP ? restart || close : close).focus();
                    return true;
                }
                copy.scrollTop +=
                    (key === keys.UP ? -1 : 1) *
                    Math.max(48, copy.clientHeight * 0.6);
                return true;
            }
            if (key !== keys.RETURN && key !== keys.EXIT && key !== keys.ENTER)
                return false;
            var begin =
                key === keys.ENTER &&
                (restartRequested ||
                    (!!restart && doc.activeElement === restart));
            if (begin && !canBegin()) return true;
            if (typeof host.$ === "function") host.$(dialog).hide();
            else dialog!.style.display = "none";
            dialog!.textContent = "";
            host.dialogBoxKeyHandler = null;
            if (typeof host.showChannelInfo === "function")
                host.showChannelInfo(1, true);
            if (typeof onClose === "function") onClose();
            if (begin) host.shiftArchive(-6e6);
            return true;
        }
    );
    close.onclick = function (event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        handler(keys.RETURN);
    };
    if (restart)
        restart.onclick = function (event: MouseEvent): void {
            event.preventDefault();
            event.stopPropagation();
            restartRequested = true;
            try {
                handler(keys.ENTER);
            } finally {
                restartRequested = false;
            }
        };
    copy.focus();
    return true;
}

/** Preserve paragraph/line boundaries without reinterpreting provider HTML. */
function playbackDescriptionText(root: Element | null): string {
    var pending: (Node | string)[] = root ? [root] : [];
    var parts: string[] = [];
    while (pending.length) {
        var node = pending.pop()!;
        if (typeof node === "string") {
            parts.push(node);
            continue;
        }
        if (node.nodeType === 3) {
            parts.push(node.textContent || "");
            continue;
        }
        if (node.nodeType !== 1) continue;
        var tag = (node as Element).tagName;
        if (/^(IMG|SCRIPT|STYLE)$/.test(tag)) continue;
        var block = /^(BR|P|DIV|LI|UL|OL|H[1-6]|BLOCKQUOTE|TR|TABLE)$/.test(
            tag
        );
        if (/^(TD|TH)$/.test(tag)) pending.push("\t");
        if (block) {
            parts.push("\n");
            if (tag !== "BR") pending.push("\n");
        }
        for (var i = node.childNodes.length - 1; i >= 0; i--)
            pending.push(node.childNodes[i]);
    }
    return parts
        .join("")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// This module is part of the optional Modern asset, not Classic startup.
if (typeof window !== "undefined")
    (window as any).showPlaybackInfo = function (
        onClose?: () => void
    ): boolean {
        return showModernPlaybackInfo(window, onClose);
    };
