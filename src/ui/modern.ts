/** Lazy presentation capability; the host still owns category and item selection. */
function createModernCatalogShelves(host: any) {
    var cachedRender: any = null,
        cachedOwner: any = null,
        cachedSource: any = null,
        cachedCategory: any,
        cached: any;
    return function (render: any): any {
        var owner = host.__ottClassicScreenPort?.listOwner(),
            catalog = render?.__ottCatalog;
        if (
            !catalog ||
            !owner ||
            owner.model.render !== render ||
            host.getListItemFn !== render
        )
            return;
        var channels = host.__ottChannels,
            channelSource = catalog.channelSource,
            source = channelSource
                ? channels?.remoteCatalog?.()
                : catalog.shelves,
            groups = source?.groups,
            identity = channelSource ? source : source?.source,
            category = catalog.categoryIndex,
            channelRows: any,
            entries: any = Object.create(null);
        if (!Array.isArray(groups)) return;
        function channelRowsCurrent(): boolean {
            return !!(
                channelRows &&
                host.listCatIndex === category &&
                host.listArray === channelRows &&
                host.listDataArray === channelRows &&
                host.cats[host.catsArray[category]] === channelRows &&
                owner.model.items === channelRows &&
                owner.model.rows === channelRows &&
                typeof host.channelsKeyHandler === "function" &&
                owner.model.handler === host.channelsKeyHandler &&
                host.listKeyHandler === host.channelsKeyHandler
            );
        }
        if (channelSource) {
            if (source !== channelSource) {
                if (
                    typeof source.generation !== "number" ||
                    source.generation !== channelSource.generation
                )
                    return;
                category = host.listCatIndex;
            }
            channelRows = host.cats?.[host.catsArray?.[category]];
            if (!source.active() || !channelRowsCurrent()) return;
        }
        if (
            cachedRender === render &&
            cachedOwner === owner &&
            cachedSource === source &&
            cachedCategory === category &&
            cached?.source === identity
        )
            return cached;
        cachedRender = render;
        cachedOwner = owner;
        cachedSource = source;
        cachedCategory = category;
        cached = undefined;
        groups.forEach(function (group: any) {
            if (
                group &&
                typeof group.id === "string" &&
                Array.isArray(group.members)
            )
                entries[group.id] = { group: group, members: group.members };
        });
        function admitted(): boolean {
            return !!(
                owner === host.__ottClassicScreenPort?.listOwner() &&
                owner.foreground() &&
                owner.model.render === render &&
                host.getListItemFn === render &&
                render.__ottCatalog === catalog &&
                !host.__ottKiosk?.enabled?.() &&
                !host.__ottKiosk?.locked?.() &&
                source.groups === groups &&
                (channelSource
                    ? catalog.channelSource === channelSource &&
                      channels === host.__ottChannels &&
                      channels.remoteCatalog() === source &&
                      source.active() &&
                      channelRowsCurrent()
                    : catalog.shelves === source && source.source === identity)
            );
        }
        return (cached = {
            focus: function (groupId: string, index: number): boolean {
                var entry = entries[groupId];
                if (
                    !entry ||
                    groupId === "system:favorites" ||
                    typeof index !== "number" ||
                    !isFinite(index) ||
                    index % 1 ||
                    index < 0 ||
                    index >= entry.members.length
                )
                    return false;
                var members = entry.members,
                    id = members[index];
                if (
                    id == null ||
                    !admitted() ||
                    entry.group.id !== groupId ||
                    entry.group.members !== members ||
                    members[index] !== id
                )
                    return false;
                if (!channelSource)
                    return (
                        typeof source.focus === "function" &&
                        source.focus(groupId, index) === true
                    );
                var category = channels.index(groupId),
                    currentMembers = host.cats[host.catsArray[category]];
                if (
                    category < 0 ||
                    !currentMembers ||
                    currentMembers[index] !== id ||
                    !admitted() ||
                    entry.group.members !== members ||
                    members[index] !== id ||
                    typeof host.channelsList !== "function"
                )
                    return false;
                host.channelsList(category, index);
                return true;
            },
            groups: groups,
            selected: channelSource ? groups[category]?.id : source.selected,
            source: identity,
        });
    };
}

/** Selected-item buttons use the same owned commands as the current list. */
function createModernSelectedActions(host: any) {
    return function () {
        var owner = host.__ottClassicScreenPort?.listOwner(),
            model = owner?.model,
            render = model?.render,
            rows = model?.rows?.length ? model.rows : model?.items,
            index = model?.focus,
            item = rows && rows[index];
        function admitted(): boolean {
            var current = owner?.model;
            return !!(
                owner &&
                owner === host.__ottClassicScreenPort?.listOwner() &&
                owner.foreground() &&
                !host.__ottKiosk?.locked() &&
                !host.__ottKiosk?.enabled?.() &&
                current?.render === render &&
                current?.focus === index &&
                (current?.rows?.length ? current.rows : current?.items) ===
                    rows &&
                rows[index] === item &&
                typeof host._doKey === "function"
            );
        }
        if (
            !(render?.__ottCatalog || render?.__ottMediaRows) ||
            !Array.isArray(rows) ||
            typeof index !== "number" ||
            index < 0 ||
            index >= rows.length ||
            index % 1 ||
            item == null ||
            !admitted()
        )
            return [];
        var media = render.__ottMediaRows
            ? item
            : render.__ottCatalog?.row?.(item)?.__ottMediaItem;
        var actions: any[] = [];
        function add(id: string, label: string, key: number) {
            if (!key) return;
            actions.push({
                id: id,
                label:
                    label === "Play"
                        ? host._("Play")
                        : label === "Open"
                          ? host._("Open")
                          : host._("Description"),
                run: function () {
                    if (
                        admitted() &&
                        (id !== "details" ||
                            host.document
                                ?.getElementById("listPodval")
                                ?.querySelector('[data-ott-key="' + key + '"]'))
                    )
                        host._doKey(key);
                },
            });
        }
        add(
            "play",
            media?.playlist_url || media?.__ottMediaNext ? "Open" : "Play",
            host.keys?.ENTER
        );
        var footer = host.document?.getElementById("listPodval");
        var detailKeys = [host.keys?.INFO, host.keys?.N2];
        for (var i = 0; footer && i < detailKeys.length; i++) {
            var key = Number(detailKeys[i]);
            if (key && footer.querySelector('[data-ott-key="' + key + '"]')) {
                add("details", "Description", key);
                break;
            }
        }
        return actions;
    };
}

/** Variable-length shelves navigate through their current owned presentation. */
function createModernShelfTouch(w: any) {
    function admitted(gesture: any, owner: any, metrics: any): boolean {
        return !!(
            gesture.shelves.source != null &&
            w.__ottModernUi === gesture.shelves.modern &&
            owner === w.__ottClassicScreenPort?.listOwner() &&
            owner?.foreground() &&
            w.isListVisible &&
            metrics?.shelves &&
            metrics.source === gesture.shelves.source &&
            !w.__ottKiosk?.locked?.() &&
            !w.__ottKiosk?.enabled?.() &&
            !w.__ottKiosk?.strict?.()
        );
    }
    return {
        moveTouch: function (
            gesture: any,
            touch: any,
            minX: number,
            isCurrent: () => boolean
        ): boolean {
            if (!gesture.axis) return true;
            var horizontal = gesture.axis === "horizontal";
            var threshold = horizontal ? Math.max(8, minX) : gesture.rowHeight;
            var travel = horizontal
                ? gesture.startX - touch.clientX
                : gesture.referenceY - touch.clientY;
            if (Math.abs(travel) < threshold) return true;
            // Coalesced movement advances one shelf/card. Discard overscroll so
            // reversing at either boundary responds without a long dead zone.
            gesture.startX = touch.clientX;
            gesture.referenceY = touch.clientY;
            var handled = gesture.shelves.modern.navigation?.(
                {
                    id: horizontal
                        ? travel > 0
                            ? "right"
                            : "left"
                        : travel > 0
                          ? "down"
                          : "up",
                },
                gesture.owner
            );
            if (!isCurrent()) return true;
            var owner = w.__ottClassicScreenPort?.listOwner();
            var metrics = w.__ottModernUi?.touchMetrics?.(owner);
            var rows = w.listDataArray?.length ? w.listDataArray : w.listArray;
            if (
                !handled ||
                !admitted(gesture, owner, metrics) ||
                !(metrics.height > 0) ||
                !isFinite(metrics.height) ||
                !rows?.length
            ) {
                gesture.cancelled = gesture.moved = true;
                return true;
            }
            // Only this admitted synchronous transition may replace capture.
            gesture.owner = owner;
            gesture.rows = rows;
            gesture.rowHeight = metrics.height;
            gesture.rowStride = metrics.stride;
            return true;
        },
        touchCurrent: function (gesture: any): boolean {
            return admitted(
                gesture,
                gesture.owner,
                w.__ottModernUi?.touchMetrics?.(gesture.owner)
            );
        },
    };
}

/** Optional presentation adapter. Catalogues, actions and playback stay owned by the host. */
function createModernInterface(w: any) {
    var artworkLoader =
            typeof w.__ottModernArtworkFactory === "function"
                ? w.__ottModernArtworkFactory(w)
                : null,
        defaultSelectedActions = createModernSelectedActions(w),
        catalogShelves = createModernCatalogShelves(w),
        shelfTouch = createModernShelfTouch(w),
        artworkSource: any = null,
        shelfInputTarget: HTMLElement | null = null,
        shelfInputParent: HTMLElement | null = null,
        rows: any[] = [],
        formatter: any = null,
        layout: any = null,
        shapeFormatter: any = null,
        shapeGrid = false,
        shell: HTMLElement | null = null,
        shellParent: HTMLElement | null = null,
        actions: any[] = [],
        actionContext: any = {},
        railFocus = -1,
        shellFormatter: any = null,
        view = "home",
        heroActions: any[] = [],
        heroContext: any = {},
        heroFocus = -1,
        shelfSource: any = null,
        shelfGroups: any[] = [],
        shelfPositions: any = Object.create(null),
        shelfWheelAt = 0,
        shelfWheelEventAt = 0,
        shelfWheelDelta = 0;
    function supported(): boolean {
        if (w.CSS && typeof w.CSS.supports === "function")
            return w.CSS.supports("display", "grid");
        var probe = w.document.createElement("div");
        probe.style.display = "grid";
        return probe.style.display === "grid";
    }
    function enabled(): boolean {
        return (
            Number(w.settings ? w.settings.interfaceMode : w.sInterfaceMode) ===
                1 &&
            (!w.__ottInterfaceModeState ||
                w.__ottInterfaceModeState.effective === 1)
        );
    }
    function escape(value: any): string {
        return String(value == null ? "" : value).replace(
            /[&<>"']/g,
            function (character) {
                return {
                    "'": "&#39;",
                    '"': "&quot;",
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                }[character]!;
            }
        );
    }
    function text(value: any): string {
        return String(value == null ? "" : value)
            .replace(/\s+/g, " ")
            .trim();
    }
    function artwork(value: any): string {
        var url = String(value || "").trim();
        if (/[\u0000-\u001f\u007f]/.test(url)) return "";
        if (
            /^[a-z][a-z0-9+.-]*:/i.test(url) &&
            !/^(https?:|blob:|data:image\/(?:png|jpe?g|webp|gif|avif|svg\+xml);)/i.test(
                url
            )
        )
            return "";
        return url;
    }
    function project(item: any): any {
        var catalog = formatter && formatter.__ottCatalog;
        var channel = catalog ? catalog.row(item) : null;
        var media = channel
            ? channel.__ottMediaItem
            : formatter && formatter.__ottMediaRows
              ? item
              : null;
        if (!channel && !media) return null;
        var mixed = catalog && catalog.kind === "mixed";
        var summary = media
            ? media.description || media.summary || media.plot || ""
            : channel.description || channel.descr || "";
        var synopsisOffset = media?.__ottMediaSynopsisOffset;
        // The source identifies its synopsis within the full description. Keep
        // its title/year/duration in Details without duplicating long plot text.
        if (
            typeof summary === "string" &&
            typeof synopsisOffset === "number" &&
            isFinite(synopsisOffset) &&
            synopsisOffset % 1 === 0 &&
            synopsisOffset >= -1 &&
            synopsisOffset <= summary.length
        )
            summary =
                synopsisOffset === -1 ? "" : summary.slice(synopsisOffset);
        return {
            backdrop: artwork(
                (media &&
                    (media.backdrop ||
                        media.poster ||
                        media.art ||
                        media.thumb)) ||
                    (channel && (channel.backdrop || channel.art))
            ),
            channel: channel,
            id: item,
            image: artwork(
                (media && (media.poster || media.logo_30x30)) ||
                    (catalog && catalog.picon
                        ? catalog.picon(item)
                        : channel && (channel.logo || channel.icon))
            ),
            media: !!media || !!mixed,
            meta: text(
                mixed
                    ? channel.modernMeta || ""
                    : media
                      ? media.__ottMediaCollection || media.year || ""
                      : channel.modernMeta || channel.name || ""
            ),
            playing: !!(catalog && catalog.playing && catalog.playing(item)),
            summary: summary,
            title: text(
                channel
                    ? channel.modernTitle || channel.channel_name
                    : media.title || media.name
            ),
        };
    }
    function label(value: string): string {
        if (typeof w._ !== "function") return value;
        if (value === "Menu") return w._("Menu");
        if (value === "Channel list") return w._("Channel list");
        if (value === "Media Library") return w._("Media Library");
        if (value === "Channels") return w._("Channels");
        if (value === "Favorites") return w._("Favorites");
        if (value === "Home") return w._("Home");
        return value;
    }
    function homeView(): boolean {
        return shapeGrid && view === "home";
    }
    function icon(id: string): string {
        var paths: any = {
            browse: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
            categories: '<path d="M4 6h16M4 12h16M4 18h16"/>',
            details:
                '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
            favorites:
                '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
            home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',
            library:
                '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>',
            play: '<path d="m8 4 12 8-12 8z"/>',
            providers:
                '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m9 9 6 3-6 3z"/>',
            search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
            settings:
                '<circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/>',
        };
        return paths[id]
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                  paths[id] +
                  "</svg>"
            : "";
    }
    function changeView(next: string): void {
        if (next === view) return;
        view = next;
        railFocus = heroFocus = -1;
        refresh();
    }
    function foreground(): any {
        var owner = w.__ottClassicScreenPort?.listOwner?.();
        return owner && owner.foreground() && w.isListVisible ? owner : null;
    }
    function locked(): boolean {
        return !!(w.__ottKiosk?.locked?.() || w.__ottKiosk?.enabled?.());
    }
    function removeShell(): void {
        bindShelfInput(null);
        artworkLoader?.reset();
        railFocus = -1;
        heroFocus = -1;
        actions = [];
        heroActions = [];
        actionContext = {};
        heroContext = {};
        if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
        if (shellParent)
            shellParent.classList.remove(
                "modern-screen",
                "modern-screen-catalog",
                "modern-screen-grid",
                "modern-screen-live",
                "modern-screen-menu",
                "modern-empty",
                "modern-rail-focused",
                "modern-has-controls",
                "modern-has-shelves",
                "modern-view-home",
                "modern-view-library"
            );
        shell = shellParent = null;
        shellFormatter = null;
    }
    function syncRailFocus(): void {
        if (!shell) return;
        var buttons = shell.querySelectorAll(".modern-rail-action");
        for (var i = 0; i < buttons.length; i++) {
            var button = buttons[i] as HTMLElement;
            button.classList.toggle("modern-rail-selected", i === railFocus);
            button.tabIndex = i === Math.max(0, railFocus) ? 0 : -1;
            if (i === railFocus) button.focus();
        }
    }
    function focusRail(index: number): void {
        if (!shell || !actions.length || locked()) return;
        var direction = index < railFocus ? -1 : 1;
        var target = Math.max(0, Math.min(actions.length - 1, index));
        while (actions[target].disabled) {
            target += direction;
            if (target < 0 || target >= actions.length) return;
        }
        railFocus = target;
        heroFocus = -1;
        shellParent?.classList.add("modern-rail-focused");
        syncRailFocus();
    }
    function focusContent(): void {
        railFocus = -1;
        heroFocus = -1;
        shellParent?.classList.remove("modern-rail-focused");
        syncRailFocus();
        var selected = w.document.getElementById("it" + w.selIndex);
        if (selected) selected.focus();
    }
    function invokeAction(index: number, event?: Event): void {
        var owner = foreground();
        var action = actions[index];
        if (!enabled() || !owner || !action || action.disabled || locked())
            return;
        // Buttons retained by a settings/confirmation overlay are never active.
        if (owner.model.render !== formatter) return;
        railFocus = -1;
        shellParent?.classList.remove("modern-rail-focused");
        if (action.key && typeof w._doKey === "function")
            w._doKey(action.key, event);
        else if (typeof action.run === "function") action.run();
    }
    function makeShell(): boolean {
        var parent = w.document.getElementById("list");
        if (!enabled() || !parent) {
            removeShell();
            return false;
        }
        if (shell && shellParent !== parent) removeShell();
        shellParent = parent;
        if (!shell) {
            shell = w.document.createElement("div") as HTMLElement;
            shell.id = "modernShell";
            shell.innerHTML =
                '<nav id="modernRail"><div class="modern-rail-actions"></div></nav>' +
                '<nav class="modern-account-actions"></nav>' +
                '<section id="modernHero"><div class="modern-hero-art"></div><div class="modern-hero-copy"><span class="modern-eyebrow"></span><h1 class="modern-hero-title"></h1><div class="modern-hero-meta"></div><div class="modern-hero-summary"></div><div class="modern-hero-actions"></div></div></section>' +
                '<header id="modernLibraryHeading"><span class="modern-library-title"></span><div class="modern-library-actions"></div><span class="modern-library-count"></span></header>';
            shell
                .querySelector("#modernRail")!
                .setAttribute("aria-label", label("Menu"));
            parent.insertBefore(shell, parent.firstChild);
        }
        parent.classList.add("modern-screen");
        return true;
    }
    function actionButton(
        action: any,
        retained: any,
        hero: boolean
    ): HTMLButtonElement {
        var button = retained || w.document.createElement("button");
        if (!retained) {
            button.type = "button";
            button.className = "modern-" + (hero ? "hero" : "rail") + "-action";
            button.setAttribute(
                "data-modern-" + (hero ? "hero-" : "") + "action",
                action.id
            );
            button.innerHTML =
                (hero
                    ? ""
                    : '<span class="modern-rail-icon" aria-hidden="true">') +
                icon(action.id) +
                (hero ? "" : "</span>") +
                (hero
                    ? "<span></span>"
                    : '<span class="modern-rail-label"></span>');
        }
        button.setAttribute("aria-label", action.label);
        if (!hero) {
            button.title = action.label;
            if (action.active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
            button.disabled = !!action.disabled || locked();
            var image = button.firstElementChild;
            if (!icon(action.id) && image.textContent !== (action.icon || "•"))
                image.textContent = action.icon || "•";
        }
        var caption = button.lastElementChild;
        if (caption.textContent !== action.label)
            caption.textContent = action.label;
        return button;
    }
    function bindAction(
        button: HTMLButtonElement,
        action: any,
        index: number,
        owner: any,
        hero?: boolean,
        item?: any
    ): void {
        function activate(event: Event): void {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (
                (hero ? heroActions : actions)[index] !== action ||
                foreground() !== owner ||
                !shell?.contains(button)
            )
                return;
            if (!hero) invokeAction(index, event);
            else if (
                enabled() &&
                !locked() &&
                owner &&
                owner.model.render === formatter &&
                rows[Number(w.selIndex)] === item
            ) {
                heroFocus = -1;
                if (typeof action.run === "function") action.run();
                else if (action.key && typeof w._doKey === "function")
                    w._doKey(action.key, event);
            }
        }
        button.onclick = activate;
        button.onkeydown = function (event) {
            if (event.key === "Enter" || event.key === " ") activate(event);
        };
        button.onfocus = function () {
            if (hero) {
                railFocus = -1;
                heroFocus = index;
                shellParent?.classList.remove("modern-rail-focused");
                syncRailFocus();
            } else if (actions[index] === action && railFocus !== index)
                focusRail(index);
        };
    }
    function region(action: any): number {
        return action.id === "categories"
            ? 2
            : action.id === "providers" || action.id === "settings"
              ? 1
              : 0;
    }
    function renderActionButtons(
        next: any[],
        context: any,
        owner: any,
        roots: any[],
        hero = false,
        item?: any
    ): void {
        var previous = hero ? heroActions : actions;
        var retained = shell!.querySelectorAll(
            hero ? ".modern-hero-action" : ".modern-rail-action"
        );
        var reuse =
            context.owner === owner &&
            context.renderer === formatter &&
            context.item === item &&
            previous.length === next.length &&
            retained.length === next.length &&
            next.every(function (action, index) {
                return previous[index].id === action.id;
            });
        context.owner = owner;
        context.renderer = formatter;
        context.item = item;
        if (hero) heroActions = next;
        else actions = next;
        if (!reuse)
            roots.forEach(function (root) {
                root.textContent = "";
            });
        if (hero) roots[0].hidden = !next.length;
        next.forEach(function (action, index) {
            var button = actionButton(action, reuse && retained[index], hero);
            if (!hero) button.tabIndex = index === 0 ? 0 : -1;
            bindAction(button, action, index, owner, hero, item);
            if (!reuse) roots[hero ? 0 : region(action)].appendChild(button);
        });
    }
    function syncActions(): void {
        if (!shell) return;
        var supplied =
            typeof w.__ottModernActions === "function"
                ? w.__ottModernActions()
                : [];
        var next: any[] = [];
        var used: any = Object.create(null);
        function add(action: any): void {
            if (!action || !action.id || !action.label || used[action.id])
                return;
            var name = "label:" + text(action.label).toLowerCase();
            if (used[name]) return;
            used[action.id] = used[name] = true;
            next.push(action);
        }
        if (!Array.isArray(supplied)) supplied = [];
        var browse = supplied.filter(function (action) {
            return action?.id === "browse";
        })[0];
        var library = supplied.filter(function (action) {
            return action?.id === "library";
        })[0];
        var catalog = !!(
            formatter &&
            (formatter.__ottCatalog || formatter.__ottMediaRows)
        );
        if (catalog) {
            if (shapeGrid)
                add({
                    active: homeView(),
                    id: "home",
                    label: label("Home"),
                    run: function () {
                        changeView("home");
                    },
                });
            add({
                active: !homeView(),
                id: "library",
                label: shapeGrid ? label("Media Library") : label("Channels"),
                run: function () {
                    changeView("library");
                },
            });
            used.browse = true;
        } else
            add(
                browse ||
                    library || {
                        icon: "▦",
                        id: "browse",
                        label: label("Channel list"),
                        run: focusContent,
                    }
            );
        supplied.slice(0, 10).forEach(function (action) {
            // The contextual heading is absent on option pages; it must not
            // leave an invisible but keyboard-active category control behind.
            if (!catalog && action?.id === "categories") return;
            add(action);
        });
        var footer = w.document.getElementById("listPodval");
        var buttons = footer && footer.querySelectorAll("[data-ott-key]");
        if (typeof w.__ottModernActions !== "function" && buttons)
            for (var i = 0; i < Math.min(buttons.length, 8); i++) {
                var key = Number(buttons[i].getAttribute("data-ott-key"));
                var title =
                    buttons[i].getAttribute("aria-label") ||
                    buttons[i].getAttribute("title") ||
                    text(buttons[i].textContent);
                if (key && title)
                    add({
                        icon: "•",
                        id: "key-" + key,
                        key: key,
                        label: title,
                    });
            }
        // The focus order follows the rendered groups, including controls moved
        // out of the capsule. Stable action IDs keep host routes authoritative.
        var groups: any[][] = [[], [], []];
        next.forEach(function (action) {
            groups[region(action)].push(action);
        });
        next = groups[0].concat(groups[1], groups[2]);
        var focusedId =
            railFocus >= 0 && actions[railFocus] && actions[railFocus].id;
        var roots = [
            shell.querySelector(".modern-rail-actions")!,
            shell.querySelector(".modern-account-actions")!,
            shell.querySelector(".modern-library-actions")!,
        ];
        var controlOwner = foreground();
        // IDs determine the region; unchanged screens retain pointer targets.
        renderActionButtons(next, actionContext, controlOwner, roots);
        if (focusedId)
            railFocus = actions
                .map(function (action) {
                    return action.id;
                })
                .indexOf(focusedId);
        if (railFocus >= 0 && actions.length) focusRail(railFocus);
        else syncRailFocus();
    }
    function syncControls(): void {
        if (!shellParent) return;
        var controls = w.document.querySelector(
            "#listDetail #mediaPlaybackControls"
        );
        shellParent.classList.toggle(
            "modern-has-controls",
            !!(
                controls &&
                !controls.hidden &&
                controls.style.display !== "none" &&
                controls.querySelector("[data-ott-key]")
            )
        );
    }
    function syncScreen(): void {
        if (!makeShell()) return;
        var isCatalog = !!(
            formatter &&
            (formatter.__ottCatalog || formatter.__ottMediaRows)
        );
        shellParent!.classList.toggle("modern-screen-catalog", isCatalog);
        shellParent!.classList.toggle("modern-screen-menu", !isCatalog);
        shellParent!.classList.toggle(
            "modern-view-home",
            isCatalog && homeView()
        );
        shellParent!.classList.toggle(
            "modern-view-library",
            isCatalog && !homeView()
        );
        shellParent!.classList.toggle(
            "modern-screen-grid",
            isCatalog && shapeGrid
        );
        shellParent!.classList.toggle(
            "modern-screen-live",
            isCatalog && !shapeGrid
        );
        if (shellFormatter !== formatter) {
            railFocus = -1;
            shellParent!.classList.remove("modern-rail-focused");
            shellFormatter = formatter;
        }
        syncActions();
        syncControls();
        var title = w.document.getElementById("listCaption");
        var heading = shell!.querySelector(".modern-library-title")!;
        var caption = title && title.cloneNode(true);
        if (caption) {
            var clock = caption.querySelector("#listTime");
            if (clock) clock.remove();
        }
        var captionText = caption
            ? text(caption.textContent)
            : label("Channel list");
        var prefix = text(
            typeof w._ === "function"
                ? w._("Channel list. Category: ")
                : "Channel list. Category: "
        );
        heading.textContent =
            captionText.indexOf(prefix) === 0
                ? text(captionText.slice(prefix.length))
                : captionText;
        var count = shell!.querySelector(".modern-library-count")!;
        count.textContent = rows.length
            ? Math.min(rows.length, Math.max(0, Number(w.selIndex) || 0) + 1) +
              " / " +
              rows.length
            : "";
        updateHero();
    }
    function updateHero(): void {
        if (!shell) return;
        var catalog = !!(
            formatter &&
            (formatter.__ottCatalog || formatter.__ottMediaRows)
        );
        var row =
            catalog && enabled() && w.selIndex >= 0 && w.selIndex < rows.length
                ? project(rows[w.selIndex])
                : null;
        shellParent!.classList.toggle("modern-empty", catalog && !row);
        var hero = shell.querySelector("#modernHero") as HTMLElement;
        hero.hidden = !row;
        updateHeroActions(row);
        if (!row) return;
        shell.querySelector(".modern-library-count")!.textContent =
            Math.max(0, Number(w.selIndex) || 0) + 1 + " / " + rows.length;
        shell.querySelector(".modern-eyebrow")!.textContent =
            formatter.__ottCatalog?.kind === "mixed"
                ? label("Favorites")
                : row.media
                  ? label("Media Library")
                  : label("Channels");
        shell.querySelector(".modern-hero-title")!.textContent = row.title;
        shell.querySelector(".modern-hero-meta")!.textContent = row.meta;
        var summary = shell.querySelector(".modern-hero-summary")!;
        // Use the shared, allowlisted description renderer. Provider formatting
        // is metadata, not literal title text or arbitrary executable HTML.
        var description =
            typeof w.getMediaDescr === "function"
                ? w.getMediaDescr({ description: row.summary })
                : escape(row.summary);
        if (summary.innerHTML !== description) summary.innerHTML = description;
        var art = shell.querySelector(".modern-hero-art")!;
        var existing = art.querySelector("img");
        var heroImage = row.backdrop || row.image;
        if (
            (existing && existing.getAttribute("data-modern-artwork")) !==
            (heroImage || null)
        ) {
            art.textContent = "";
            if (heroImage) {
                var image = w.document.createElement("img");
                image.alt = "";
                image.decoding = "async";
                image.setAttribute("data-modern-artwork", heroImage);
                art.appendChild(image);
            }
        }
        decorateArtwork(art as HTMLElement);
        hero.classList.toggle("modern-hero-with-art", !!heroImage);
    }
    function focusHero(index: number): void {
        if (!shell || !heroActions.length || locked()) return;
        var buttons = shell.querySelectorAll(".modern-hero-action");
        index = Math.max(0, Math.min(buttons.length - 1, index));
        railFocus = -1;
        heroFocus = index;
        shellParent?.classList.remove("modern-rail-focused");
        (buttons[index] as HTMLElement).focus();
    }
    function updateHeroActions(row: any): void {
        if (!shell) return;
        var root = shell.querySelector(".modern-hero-actions") as HTMLElement;
        var owner = foreground();
        var item = rows[Number(w.selIndex)];
        var supplied =
            row && (homeView() || !shapeGrid) && owner
                ? typeof w.__ottModernSelectedActions === "function"
                    ? w.__ottModernSelectedActions()
                    : defaultSelectedActions()
                : [];
        var next = Array.isArray(supplied)
            ? supplied.filter(function (action) {
                  return (
                      action &&
                      (action.id === "play" || action.id === "details") &&
                      action.label &&
                      !action.disabled
                  );
              })
            : [];
        renderActionButtons(next, heroContext, owner, [root], true, item);
        if (heroFocus >= 0 && heroActions.length) focusHero(heroFocus);
        else heroFocus = -1;
    }
    function clearDetail(): void {
        var detail = w.document.getElementById("listDetail");
        if (detail) {
            detail.classList.remove("modern-detail");
            var decorated = detail.querySelectorAll(
                ".modern-detail-title, .modern-description, .modern-detail-art"
            );
            for (var index = 0; index < decorated.length; index++)
                decorated[index].classList.remove(
                    "modern-detail-title",
                    "modern-description",
                    "modern-detail-art"
                );
        }
    }
    function reset(container: HTMLElement | null): void {
        layout = null;
        shellParent?.classList.remove("modern-empty");
        clearDetail();
        if (!container) return;
        container.classList.remove(
            "modern-catalog",
            "modern-grid",
            "modern-live",
            "modern-options",
            "modern-shelves"
        );
        container.style.display = "";
        container.style.gridTemplateColumns = "";
        container.style.gridAutoRows = "";
        container.style.gap = "";
    }
    function shelves(): any {
        return homeView() && catalogShelves(formatter);
    }
    function prepareShelves(): boolean {
        var capability = shelves();
        if (!capability || !Array.isArray(capability.groups)) {
            shelfGroups = [];
            return false;
        }
        if (shelfSource !== capability.source) {
            shelfSource = capability.source;
            shelfPositions = Object.create(null);
            shelfWheelAt = shelfWheelEventAt = shelfWheelDelta = 0;
        }
        // Membership arrays belong to the source. Only category descriptors are
        // projected here; a repaint never walks/copies every media item.
        shelfGroups = capability.groups.filter(function (group: any) {
            return (
                group &&
                typeof group.id === "string" &&
                group.id !== "system:favorites" &&
                Array.isArray(group.members) &&
                group.members.length > 0
            );
        });
        return shelfGroups.some(function (group) {
            return group.id === capability.selected;
        });
    }
    function shelfIndex(): number {
        var current = shelves();
        return shelfGroups.findIndex(function (group) {
            return group.id === current?.selected;
        });
    }
    function shelfCurrent(owner: any): boolean {
        return !!(
            layout?.shelves &&
            enabled() &&
            !locked() &&
            owner &&
            owner === foreground() &&
            owner.model.render === formatter &&
            shelves()?.source === shelfSource
        );
    }
    function selectShelf(group: any, position: number, activate = false): void {
        var owner = foreground();
        if (!shelfCurrent(owner) || !group?.members.length) return;
        var capability = shelves(),
            source = capability.source,
            index = Math.max(0, Math.min(group.members.length - 1, position)),
            item = group.members[index];
        shelfPositions[group.id] = index;
        // The host selects the occurrence, including its category and owned
        // detail/action callbacks. Modern never starts a decoder itself.
        if (capability.focus(group.id, index) !== true) return;
        var nextOwner = foreground(),
            next = shelves();
        if (
            !shelfCurrent(nextOwner) ||
            next.source !== source ||
            next.selected !== group.id ||
            rows[w.selIndex] !== item ||
            w.selIndex !== index
        )
            return;
        focusContent();
        if (activate && typeof w._doKey === "function") w._doKey(w.keys.ENTER);
    }
    function moveShelf(horizontal: number, vertical: number): void {
        var current = shelfIndex();
        if (current < 0) return;
        var group = shelfGroups[current];
        shelfPositions[group.id] = Math.max(0, Number(w.selIndex) || 0);
        if (horizontal) {
            var position = Math.max(
                0,
                Math.min(
                    group.members.length - 1,
                    shelfPositions[group.id] + horizontal
                )
            );
            if (position !== shelfPositions[group.id])
                selectShelf(group, position);
        } else if (vertical) {
            var next = Math.max(
                0,
                Math.min(shelfGroups.length - 1, current + vertical)
            );
            if (next === current) return;
            group = shelfGroups[next];
            selectShelf(group, shelfPositions[group.id] || 0);
        }
    }
    function paintShelves(
        container: HTMLElement,
        owner: any,
        restoreFocus = false
    ): boolean {
        if (!layout?.shelves) return false;
        var current = shelfIndex();
        if (current < 0) return false;
        var count = Math.min(layout.shelfCount, shelfGroups.length),
            start = Math.max(
                0,
                Math.min(
                    current > 0 ? current - 1 : 0,
                    shelfGroups.length - count
                )
            );
        if (current >= start + count) start = current;
        container.classList.add("modern-shelves");
        container.style.display = "flex";
        container.style.gridTemplateColumns = "";
        container.style.gridAutoRows = "";
        container.textContent = "";
        for (
            var g = start;
            g < Math.min(shelfGroups.length, start + count);
            g++
        ) {
            var group = shelfGroups[g],
                active = g === current,
                position = Math.min(
                    group.members.length - 1,
                    active
                        ? Math.max(0, Number(w.selIndex) || 0)
                        : shelfPositions[group.id] || 0
                ),
                first = Math.floor(position / layout.columns) * layout.columns;
            shelfPositions[group.id] = position;
            var section = w.document.createElement("section"),
                heading = w.document.createElement("h2"),
                track = w.document.createElement("div");
            section.className = "modern-shelf";
            section.setAttribute("role", "group");
            section.setAttribute("aria-label", text(group.name));
            heading.className = "modern-shelf-heading";
            heading.style.height = layout.shelfHeadingHeight + "px";
            heading.textContent = text(group.name);
            var counter = w.document.createElement("span");
            counter.textContent = position + 1 + " / " + group.members.length;
            heading.appendChild(counter);
            track.className = "modern-shelf-track";
            track.style.gridTemplateColumns =
                "repeat(" + layout.columns + ",minmax(0,1fr))";
            track.style.gap = layout.gap + "px";
            for (
                var i = first;
                i < Math.min(first + layout.columns, group.members.length);
                i++
            ) {
                var card = w.document.createElement("div");
                card.id = active ? "it" + i : "modernShelf" + g + "Item" + i;
                card.className = "modern-card" + (active ? " item" : "");
                card.setAttribute("role", "option");
                card.setAttribute("aria-posinset", String(i + 1));
                card.setAttribute("aria-setsize", String(group.members.length));
                card.setAttribute(
                    "aria-selected",
                    String(active && i === position)
                );
                card.setAttribute("data-modern-shelf", group.id);
                card.setAttribute("data-modern-position", String(i));
                if (active) card.setAttribute("data-idx", String(i));
                card.tabIndex = active && i === position ? 0 : -1;
                card.style.height = layout.cellHeight + "px";
                card.innerHTML = render(group.members[i], i) || "";
                card.classList.toggle("ott-selected", active && i === position);
                track.appendChild(card);
            }
            section.appendChild(heading);
            section.appendChild(track);
            container.appendChild(section);
        }
        decorateArtwork(container);
        w.listPageSize = layout.columns;
        w.__ottListRowH = layout.cellHeight;
        w.__ottAccessibility?.select(container, w.selIndex, restoreFocus);
        syncScreen();
        return true;
    }
    function shelfPointer(event: any, activate: boolean): boolean {
        if (!layout?.shelves || !enabled()) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        var owner = foreground();
        if (!shelfCurrent(owner)) return true;
        var node = event.target?.closest?.("[data-modern-shelf]");
        if (!node || !w.document.getElementById("listIn")?.contains(node))
            return true;
        var id = node.getAttribute("data-modern-shelf"),
            position = Number(node.getAttribute("data-modern-position")),
            group = shelfGroups.find(function (row) {
                return row.id === id;
            });
        if (
            !group ||
            position < 0 ||
            position >= group.members.length ||
            position % 1
        )
            return true;
        selectShelf(
            group,
            position,
            activate || (id === shelves().selected && position === w.selIndex)
        );
        return true;
    }
    function shelfWheel(event: any): boolean {
        if (!layout?.shelves || !enabled()) return false;
        if (event.ctrlKey) return true;
        event.preventDefault();
        event.stopPropagation();
        if (!shelfCurrent(foreground())) return true;
        var delta =
            Number(event.deltaY || event.detail || -event.wheelDelta) || 0;
        if (!delta) return true;
        var now = Date.now();
        if (now - shelfWheelAt < 160) return true;
        if (
            now - shelfWheelEventAt > 600 ||
            Math.sign(delta) !== Math.sign(shelfWheelDelta)
        )
            shelfWheelDelta = 0;
        shelfWheelEventAt = now;
        shelfWheelDelta +=
            delta *
            (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
        if (Math.abs(shelfWheelDelta) >= 24) {
            shelfWheelAt = now;
            moveShelf(0, shelfWheelDelta > 0 ? 1 : -1);
            shelfWheelDelta = 0;
        }
        return true;
    }
    function shelfInput(event: any): void {
        if (
            !shelfInputTarget?.contains(event.target) ||
            w.__ottTauriSuppressClick
        )
            return;
        if (/wheel|DOMMouseScroll/.test(event.type)) {
            if (shelfWheel(event)) event.stopImmediatePropagation();
        } else if (
            event.type === "click" ||
            event.keyCode === 13 ||
            event.keyCode === 32
        ) {
            shelfPointer(
                event,
                event.type === "keydown" ||
                    event.ottNativeListTap === true ||
                    w.ott_device === "lg/webos" ||
                    w.ott_device === "lg/netcast"
            );
        }
    }
    function bindShelfInput(container: HTMLElement | null): void {
        var parent = container?.parentElement || null;
        if (shelfInputTarget === container && shelfInputParent === parent)
            return;
        ["click", "keydown", "wheel", "mousewheel", "DOMMouseScroll"].forEach(
            function (name) {
                shelfInputParent?.removeEventListener(name, shelfInput, true);
                parent?.addEventListener(name, shelfInput, true);
            }
        );
        shelfInputTarget = container;
        shelfInputParent = parent;
    }
    function prepare(
        items: any[],
        render: any,
        container: HTMLElement | null
    ): any {
        var nextArtworkSource = render?.__ottCatalog?.channelSource
            ? catalogShelves(render)?.source || render
            : render?.__ottCatalog?.shelves?.source || render;
        if (artworkSource !== nextArtworkSource) artworkLoader?.reset();
        artworkSource = nextArtworkSource;
        reset(container);
        rows = items;
        formatter = render;
        if (!enabled() || !container || !render) {
            removeShell();
            return null;
        }
        bindShelfInput(container);
        var menu = !(render.__ottCatalog || render.__ottMediaRows);
        // Choose one shape per source formatter, never from selection. Mixed
        // Favorites must not jump between rows and cards on page changes.
        if (!menu && shapeFormatter !== render) {
            var sample: any = null;
            for (var at = 0; at < Math.min(items.length, 16) && !sample; at++)
                sample = project(items[at]);
            shapeGrid = !!(
                render.__ottCatalog?.kind === "mixed" ||
                render.__ottMediaRows ||
                (sample && sample.media)
            );
            if (sample || render.__ottMediaRows) shapeFormatter = render;
        }
        syncScreen();
        var grid = !menu && shapeGrid;
        var categoryShelves = grid && prepareShelves();
        shellParent?.classList.toggle("modern-has-shelves", !!categoryShelves);
        var scale = Math.max(
            0.7,
            Math.min(2, Number(w.sUiFontScale || 100) / 100)
        );
        // clientWidth/clientHeight include the Classic theme's inline padding.
        // Grid tracks occupy the content box; counting that padding again can
        // clip the final row and leave the host retrying its layout forever.
        var style = w.getComputedStyle ? w.getComputedStyle(container) : null;
        function inset(name: string): number {
            return style ? parseFloat(style[name]) || 0 : 0;
        }
        var width = Math.max(
            1,
            (container.clientWidth || w.innerWidth * 0.55) -
                inset("paddingLeft") -
                inset("paddingRight")
        );
        var height = Math.max(
            1,
            (container.clientHeight || w.innerHeight * 0.7) -
                inset("paddingTop") -
                inset("paddingBottom")
        );
        var gap = Math.max(8, Math.round((w.innerWidth / 1920) * 30));
        var cardWidth = Math.max(128, (w.innerWidth / 1920) * 250) * scale;
        var columns = grid
            ? Math.max(
                  1,
                  Math.min(8, Math.floor((width + gap) / (cardWidth + gap)))
              )
            : 1;
        var cellWidth = Math.max(
            1,
            Math.floor((width - gap * (columns - 1) - 2) / columns)
        );
        // Home keeps one landscape shelf below the hero. Library is a poster
        // grid; neither presentation changes the catalogue or current selection.
        var home = grid && homeView();
        // The caption occupies two text lines plus its existing padding.
        // Reserve that natural height rather than stretching a single poster
        // row over the entire remaining viewport.
        var captionHeight =
            grid && !home
                ? Math.max(52 * scale, (parseFloat(style?.fontSize) || 0) * 3.2)
                : 52 * scale;
        var preferredHeight = grid
            ? (cellWidth - (home ? 0 : 2)) * (home ? 0.5625 : 1.5) +
              captionHeight +
              (home ? 0 : 2)
            : (menu ? 50 : 66) * Math.max(0.75, w.innerHeight / 720) * scale;
        while (grid && !home && preferredHeight > height && columns < 8) {
            columns++;
            cellWidth = Math.max(
                1,
                Math.floor((width - gap * (columns - 1) - 2) / columns)
            );
            preferredHeight = (cellWidth - 2) * 1.5 + captionHeight + 2;
        }
        var count = Math.max(
            1,
            Math.min(
                home ? 1 : grid ? 2 : 12,
                Math.floor((height + gap) / (preferredHeight + gap))
            )
        );
        var cellHeight = Math.max(
            1,
            Math.floor((height - gap * (count - 1) - 2) / count)
        );
        if (grid && !home)
            cellHeight = Math.min(cellHeight, Math.ceil(preferredHeight));
        var shelfHeadingHeight = 32 * scale;
        var shelfCount = categoryShelves
            ? Math.max(
                  1,
                  Math.min(
                      2,
                      shelfGroups.length,
                      Math.floor(
                          (height + gap) /
                              (110 * scale + shelfHeadingHeight + gap)
                      )
                  )
              )
            : 0;
        if (categoryShelves)
            cellHeight = Math.max(
                72,
                Math.floor(
                    (height - gap * (shelfCount - 1)) / shelfCount -
                        shelfHeadingHeight
                )
            );
        layout = {
            cellHeight: cellHeight,
            cellWidth: cellWidth,
            columns: columns,
            gap: gap,
            grid: grid,
            home: home,
            menu: menu,
            pageSize: columns * count,
            shelfCount: shelfCount,
            shelfHeadingHeight: shelfHeadingHeight,
            shelves: categoryShelves,
        };
        if (menu) container.classList.add("modern-options");
        else
            container.classList.add(
                "modern-catalog",
                grid ? "modern-grid" : "modern-live"
            );
        container.style.display = "grid";
        container.style.gridTemplateColumns =
            "repeat(" + columns + ", minmax(0, 1fr))";
        container.style.gridAutoRows = cellHeight + "px";
        container.style.gap = gap + "px";
        return layout;
    }
    function render(item: any, index: number): string | null {
        if (!layout || layout.menu || !enabled()) return null;
        var row = project(item);
        if (!row) return null;
        var image = row.image
            ? '<img alt="" loading="lazy" decoding="async" data-modern-artwork="' +
              escape(row.image) +
              '">'
            : "";
        var art =
            '<span class="modern-art"><span class="modern-art-fallback" aria-hidden="true">' +
            escape((row.title || "?").slice(0, 1)) +
            "</span>" +
            image +
            "</span>";
        var programme = row.media
            ? '<span class="modern-meta">' + escape(row.meta) + "</span>"
            : '<span class="modern-meta modern-programme" id="pn' +
              escape(item) +
              '">' +
              escape(row.meta) +
              "</span>";
        return (
            '<span class="modern-number">' +
            (index + 1) +
            "</span>" +
            art +
            '<span class="modern-copy"><span class="modern-title">' +
            escape(row.title) +
            "</span>" +
            programme +
            "</span>" +
            (!row.media
                ? '<span class="modern-progress"><span id="pr' +
                  escape(item) +
                  '"></span></span>'
                : "")
        );
    }
    function decorateArtwork(container: HTMLElement): void {
        if (artworkLoader) artworkLoader.decorate(container);
        else {
            var images = container.querySelectorAll("img[data-modern-artwork]");
            for (var i = 0; i < images.length; i++) {
                var image = images[i] as HTMLImageElement;
                image.onerror = function () {
                    this.style.display = "none";
                };
                image.src = image.getAttribute("data-modern-artwork") || "";
            }
        }
    }
    function decorate(
        container: HTMLElement,
        start: number,
        end: number
    ): void {
        if (!layout) return;
        for (var index = start; index < end; index++) {
            var element = w.document.getElementById("it" + index);
            var row = layout.menu ? null : project(rows[index]);
            if (!element || (!layout.menu && !row)) continue;
            element.classList.add(
                layout.menu
                    ? "modern-option"
                    : layout.grid
                      ? "modern-card"
                      : "modern-channel"
            );
            element.classList.toggle("ott-playing", !!(row && row.playing));
            element.style.width = "100%";
            element.style.height = layout.cellHeight + "px";
            element.style.minHeight = "0";
            element.style.maxHeight = layout.cellHeight + "px";
            element.style.lineHeight = "normal";
            if (layout.menu) continue;
            if (!row.media && row.channel) {
                var channel = row.channel,
                    fill = element.querySelector(".modern-progress > span");
                if (fill)
                    fill.style.width =
                        (channel.time_to > channel.time
                            ? Math.max(
                                  0,
                                  Math.min(
                                      100,
                                      ((Date.now() / 1000 - channel.time) /
                                          (channel.time_to - channel.time)) *
                                          100
                                  )
                              )
                            : 0) + "%";
            }
        }
        decorateArtwork(container);
    }
    function beforeDetail(): HTMLElement | null {
        var row =
                layout &&
                enabled() &&
                w.selIndex >= 0 &&
                w.selIndex < rows.length
                    ? project(rows[w.selIndex])
                    : null,
            element = w.document.getElementById("listDetail");
        if (!element || !row || !row.media) {
            clearDetail();
            return null;
        }
        // Set typography before the shared renderer measures its description.
        element.classList.add("modern-detail");
        return element;
    }
    function detail(): void {
        syncControls();
        updateHero();
        var element = beforeDetail();
        if (!element) return;
        // Keep the shared detail DOM and its controls/owned callbacks intact.
        // In particular switching presentation must not re-run preview playback.
        var title = element.querySelector("#_name");
        var description = element.querySelector("#_prd");
        var image = element.querySelector("img");
        if (title) title.classList.add("modern-detail-title");
        if (description) description.classList.add("modern-description");
        if (image) image.classList.add("modern-detail-art");
    }
    function reflowDetail(): void {
        if (
            !w.isListVisible ||
            !formatter ||
            !(formatter.__ottCatalog || formatter.__ottMediaRows) ||
            !w.$
        )
            return;
        var element = w.document.getElementById("listDetail");
        var description = element && element.querySelector("#_prd");
        if (!description) return;
        var $ = w.$,
            body = $(description),
            wrapper = $(element).find("#_descr"),
            next = $(element).find("#_nextpr"),
            nextItems = $(element).find("#_nextitems"),
            height = $(element).height() || 0;
        body.stop(true).css("margin-top", 0);
        nextItems.stop(true).css("margin-top", 0);
        var target = "_prd",
            overflow;
        if (wrapper.length) {
            var titleHeight = $(element).find("#_name").outerHeight(true) || 0;
            next.css("max-height", Math.max(0, height - titleHeight) + "px");
            var available =
                w.settings && w.settings.showDescription
                    ? Math.max(
                          0,
                          height - titleHeight - (next.outerHeight(true) || 0)
                      )
                    : 0;
            wrapper.height(available);
            var nextOverflow = (nextItems.height() || 0) - (next.height() || 0);
            if (nextOverflow > 0) {
                target = "_nextitems";
                overflow = nextOverflow;
            } else overflow = (body.height() || 0) + 10 - available;
        } else {
            overflow =
                (body.height() || 0) +
                10 +
                ($(element).find("#mediaPlaybackControls").outerHeight(true) ||
                    0) -
                height;
        }
        // Changing presentation can resize retained text. Renew only its scroll
        // geometry, never the detail callback that also owns preview playback.
        if (typeof w.scrollUp === "function")
            w.scrollUp(target, overflow, 5000);
    }
    function activeGrid(owner: any): boolean {
        return !!(
            enabled() &&
            layout &&
            layout.grid &&
            owner &&
            owner.foreground() &&
            w.isListVisible &&
            owner.model.render === formatter
        );
    }
    function touchMetrics(owner: any): any {
        if (shelfCurrent(owner))
            return {
                current: shelfTouch.touchCurrent,
                height: layout.cellHeight + layout.gap,
                modern: w.__ottModernUi,
                move: shelfTouch.moveTouch,
                shelves: true,
                source: shelfSource,
                stride: 1,
            };
        return activeGrid(owner)
            ? { height: layout.cellHeight + layout.gap, stride: layout.columns }
            : null;
    }
    function navigation(command: any, owner: any): boolean {
        if (
            !enabled() ||
            !owner ||
            !owner.foreground() ||
            !w.isListVisible ||
            owner.model.render !== formatter ||
            locked()
        )
            return false;
        if (heroFocus >= 0 && shell) {
            if (command.id === "left" || command.id === "right") {
                focusHero(heroFocus + (command.id === "left" ? -1 : 1));
                return true;
            }
            if (command.id === "accept") {
                (
                    shell.querySelectorAll(".modern-hero-action")[
                        heroFocus
                    ] as HTMLElement
                )?.click();
                return true;
            }
            if (command.id === "up") {
                focusRail(0);
                return true;
            }
            if (
                command.id === "down" ||
                command.id === "back" ||
                command.id === "exit"
            ) {
                focusContent();
                return true;
            }
        }
        if (railFocus >= 0 && shell) {
            if (command.id === "left" || command.id === "right") {
                focusRail(railFocus + (command.id === "left" ? -1 : 1));
                return true;
            }
            if (command.id === "accept") {
                invokeAction(railFocus, command.event);
                return true;
            }
            if (
                command.id === "down" ||
                command.id === "back" ||
                command.id === "exit"
            ) {
                if (command.id === "down" && homeView() && heroActions.length)
                    focusHero(0);
                else focusContent();
                return true;
            }
            return command.id === "up";
        }
        var selected = Math.max(0, Number(w.selIndex) || 0);
        if (shelfCurrent(owner)) {
            if (command.id === "up" && shelfIndex() === 0) {
                if (heroActions.length) focusHero(0);
                else focusRail(0);
                return true;
            }
            if (
                [
                    "left",
                    "right",
                    "up",
                    "down",
                    "channel-up",
                    "channel-down",
                    "forward",
                    "rewind",
                    "next",
                    "previous",
                ].indexOf(command.id) >= 0
            ) {
                var horizontal =
                    command.id === "left" ? -1 : command.id === "right" ? 1 : 0;
                moveShelf(
                    horizontal,
                    horizontal
                        ? 0
                        : ["up", "channel-up", "rewind", "previous"].indexOf(
                                command.id
                            ) >= 0
                          ? -1
                          : 1
                );
                return true;
            }
        }
        var pageSize = Math.max(
            1,
            layout?.pageSize || Number(w.listPageSize) || 1
        );
        var pageStart = Math.floor(selected / pageSize) * pageSize;
        var firstVisibleRow = selected - pageStart < (layout?.columns || 1);
        // Linear lists must traverse page boundaries before entering navigation.
        var navigationEdge = activeGrid(owner)
            ? firstVisibleRow
            : selected === 0;
        if (shell && actions.length && command.id === "up" && navigationEdge) {
            if (homeView() && heroActions.length) focusHero(0);
            else {
                var active = actions
                    .map(function (action) {
                        return !!action.active;
                    })
                    .indexOf(true);
                focusRail(active >= 0 ? active : 0);
            }
            return true;
        }
        if (!activeGrid(owner)) return false;
        var delta =
            command.id === "left"
                ? -1
                : command.id === "right"
                  ? 1
                  : command.id === "up"
                    ? -layout.columns
                    : command.id === "down"
                      ? layout.columns
                      : 0;
        if (!delta) return false;
        var current = Number(w.selIndex) || 0;
        var next = Math.max(0, Math.min(rows.length - 1, current + delta));
        if (next !== current && typeof w.changeSelect === "function")
            w.changeSelect(next - current);
        return true;
    }
    function refresh(): void {
        // Repaint only. Do not close the screen, reload the source or touch the decoder.
        var player = w.__ottModernPlayer;
        if (player && typeof player.refresh === "function") player.refresh();
        if (!enabled()) {
            reset(w.document.getElementById("listIn"));
            removeShell();
        }
        if (w.isListVisible && typeof w.showPage === "function")
            w.showPage(true);
        if (enabled()) {
            syncScreen();
            detail();
        }
        reflowDetail();
    }
    return {
        beforeDetail: beforeDetail,
        decorate: decorate,
        detail: detail,
        hide: function (): void {
            bindShelfInput(null);
            artworkLoader?.reset();
            railFocus = -1;
            heroFocus = -1;
            shellParent?.classList.remove("modern-rail-focused");
        },
        moveTouch: shelfTouch.moveTouch,
        navigation: navigation,
        paintShelves: paintShelves,
        prepare: prepare,
        refresh: refresh,
        render: render,
        shelfPointer: shelfPointer,
        shelfWheel: shelfWheel,
        supported: supported,
        syncScreen: syncScreen,
        touchCurrent: shelfTouch.touchCurrent,
        touchMetrics: touchMetrics,
    };
}
(window as any).__ottModernUiFactory = createModernInterface;
(window as any).__ottModernUi = createModernInterface(window);
(window as any).__ottModernPlayer =
    typeof (window as any).__ottModernPlayerFactory === "function"
        ? (window as any).__ottModernPlayerFactory(window)
        : null;
