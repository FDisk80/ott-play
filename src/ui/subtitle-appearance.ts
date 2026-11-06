/** Optional settings UI and cue styling; default playback never executes this asset. */
(function (host: any): void {
    var keys = [
        "subtitleFontFamily",
        "subtitleFontSize",
        "subtitleTextColor",
        "subtitleOutline",
        "subtitleBackground",
    ];
    var fonts = [
        "",
        "Arial,Helvetica,sans-serif",
        "Georgia,serif",
        "Courier New,monospace",
    ];
    var sizes = [0, 0.75, 1, 1.25, 1.5, 2];
    var colors = ["", "#ffffff", "#ffff00", "#000000", "#00ffff", "#00ff00"];
    var style: HTMLStyleElement | null = null;
    var watching = false;
    var observer: any = null;
    var observed: HTMLVideoElement[] = [];
    function scaleFonts(): void {
        var doc = host.document;
        if (!doc || !doc.styleSheets || !host.location) return;
        function visit(rules: any): void {
            for (var i = 0; rules && i < rules.length; i++) {
                var rule = rules[i],
                    css = rule.style;
                if (
                    css &&
                    css.fontSize &&
                    !/::cue|shaka-text|vjs-text-track/.test(
                        rule.selectorText || ""
                    )
                ) {
                    var original =
                        css.__ottFontBase ||
                        (css.__ottFontBase = [
                            css.fontSize,
                            css.getPropertyPriority("font-size"),
                        ]);
                    var size = host.uiFontSize(original[0]);
                    if (css.fontSize !== size)
                        css.setProperty("font-size", size, original[1]);
                }
                visit(rule.cssRules);
            }
        }
        for (var i = 0; i < doc.styleSheets.length; i++) {
            var sheet = doc.styleSheets[i];
            try {
                var url = new URL(sheet.href, host.location.href);
                if (
                    (!sheet.href &&
                        sheet.ownerNode &&
                        /^(ott-interface|ott-tauri-loading-logs)-style$/.test(
                            sheet.ownerNode.id
                        )) ||
                    (sheet.href &&
                        url.origin === host.location.origin &&
                        /\/styles\/player\.css$/.test(url.pathname))
                )
                    visit(sheet.cssRules);
            } catch (_) {}
        }
    }
    function index(values: any, key: string, max: number): number {
        var n = values && values[key];
        return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
    }
    function declarations(video: HTMLVideoElement, values?: any): string {
        values = values || host.settings || {};
        var rules: string[] = [];
        var family = index(values, keys[0], 3),
            size = index(values, keys[1], 5),
            color = index(values, keys[2], 5),
            outline = index(values, keys[3], 4),
            background = index(values, keys[4], 5);
        if (family) rules.push("font-family:" + fonts[family]);
        if (size) {
            var rect = video.getBoundingClientRect();
            var height = rect.height;
            var fit = host.getComputedStyle
                ? host.getComputedStyle(video).objectFit
                : "contain";
            if (
                fit !== "cover" &&
                video.videoWidth > 0 &&
                video.videoHeight > 0
            )
                height = Math.min(
                    height,
                    (rect.width * video.videoHeight) / video.videoWidth
                );
            if (height > 0)
                rules.push(
                    "font-size:" +
                        Math.max(
                            1,
                            Math.round(height * 0.04 * sizes[size] * 100) / 100
                        ) +
                        "px"
                );
        }
        if (color) rules.push("color:" + colors[color]);
        if (outline) {
            var width = outline - 1;
            var shadows: string[] = [];
            if (width)
                for (var x = -1; x <= 1; x++)
                    for (var y = -1; y <= 1; y++)
                        if (x || y)
                            shadows.push(
                                x * width + "px " + y * width + "px 0 #000"
                            );
            rules.push(
                "text-shadow:" + (shadows.length ? shadows.join(",") : "none")
            );
        }
        if (background)
            rules.push(
                "background-color:rgba(0,0,0," + (background - 1) / 4 + ")"
            );
        return rules
            .map(function (rule) {
                return rule + " !important;";
            })
            .join("");
    }
    function apply(): void {
        scaleFonts();
        var doc = host.document;
        if (!doc || !doc.querySelectorAll || !doc.createElement) return;
        var videos = doc.querySelectorAll("video"),
            css: string[] = [];
        observed = observed.filter(function (old) {
            for (var i = 0; i < videos.length; i++)
                if (videos[i] === old) return true;
            if (observer) observer.unobserve(old);
            return false;
        });
        for (var i = 0; i < videos.length; i++) {
            var video = videos[i],
                rules = declarations(video);
            video.setAttribute("data-ott-subtitle-style", String(i));
            var selector = 'video[data-ott-subtitle-style="' + i + '"]';
            if (rules) css.push(selector + "::cue{" + rules + "}");
            var wrapper = video.closest
                ? video.closest(".video-js")
                : video.parentElement;
            if (wrapper && /(?:^|\s)video-js(?:\s|$)/.test(wrapper.className)) {
                wrapper.setAttribute("data-ott-subtitle-wrapper", String(i));
                if (rules)
                    css.push(
                        '[data-ott-subtitle-wrapper="' +
                            i +
                            '"] .vjs-text-track-display > div > div{' +
                            rules +
                            "}"
                    );
            }
            if (observer && observed.indexOf(video) < 0) {
                observed.push(video);
                observer.observe(video);
            }
        }
        if (!style && css.length) {
            var created: HTMLStyleElement = doc.createElement("style");
            created.id = "ott-subtitle-appearance";
            (doc.head || doc.body).appendChild(created);
            style = created;
        }
        if (style && style.textContent !== css.join("\n"))
            style.textContent = css.join("\n");
        if (!watching && host.addEventListener) {
            watching = true;
            host.addEventListener("resize", apply);
            doc.addEventListener("loadedmetadata", apply, true);
            if (typeof host.ResizeObserver === "function")
                observer = new host.ResizeObserver(apply);
            if (observer) apply();
        }
    }
    function open(): void {
        var ui = host.__ottAppearanceHost;
        var page = ui.page(
            host,
            "settingsSubtitles",
            "Subtitle appearance",
            true,
            false
        );
        var label = page.label,
            defaults = [label("Player default")];
        var labels = [
            label("Font type"),
            label("Font size"),
            label("Text color"),
            label("Outline thickness"),
            label("Background opacity"),
        ];
        var options = [
            ["Arial", "Georgia", "Courier New"],
            ["75%", "100%", "125%", "150%", "200%"],
            ["#FFFFFF", "#FFFF00", "#000000", "#00FFFF", "#00FF00"],
            [label("Off"), "1 px", "2 px", "3 px"],
            ["0%", "25%", "50%", "75%", "100%"],
        ];
        var rows: any[] = labels.map(function (name, i) {
            return page.choice(name, keys[i], defaults.concat(options[i]));
        });
        rows.push({
            cur: label("select"),
            name: label("Reset to default"),
            val: 0,
            values: function () {
                rows.forEach(function (row: any) {
                    if (row.settingId) row.val = 0;
                });
                host.showPage();
            },
        });
        ui.list(host, page.rows(rows));
        page.attach();
    }
    var colorLoading = false;
    var colorOpen: ((ready: boolean) => void) | null = null;
    function openColors(): void {
        var editor = host.__ottSettingsEditor;
        var owner =
            host.__ottClassicScreenPort &&
            host.__ottClassicScreenPort.listOwner();
        var source = host.p_pref,
            driver = host.__ottActiveProviderDriver;
        if (!editor || !editor.active() || !owner || !owner.foreground())
            return;
        function ready(success: boolean): void {
            if (
                editor !== host.__ottSettingsEditor ||
                !editor.active() ||
                !owner.foreground() ||
                source !== host.p_pref ||
                driver !== host.__ottActiveProviderDriver ||
                (host.__ottStandby && host.__ottStandby.blocked())
            )
                return;
            if (success && host.__ottColorAppearance.open(editor)) return;
            if (host.showShift)
                host.showShift(host._("Failed to load!") || "Failed to load!");
        }
        if (host.__ottColorAppearance) {
            ready(true);
            return;
        }
        colorOpen = ready;
        if (colorLoading) return;
        colorLoading = true;
        var script = host.document.createElement("script");
        var settled = false;
        var timer = host.setTimeout(function () {
            finish(false);
        }, 15000);
        function finish(success: boolean): void {
            if (settled) return;
            settled = true;
            host.clearTimeout(timer);
            script.onload = script.onerror = null;
            if (script.parentNode) script.parentNode.removeChild(script);
            colorLoading = false;
            var callback = colorOpen;
            colorOpen = null;
            if (callback) callback(success && !!host.__ottColorAppearance);
        }
        script.src =
            String(host.hostUrl || host.host || "").replace(/\/$/, "") +
            "/dist/color-appearance.js?" +
            encodeURIComponent(host.__cv || "");
        if (!/^file:/.test(script.src)) script.crossOrigin = "anonymous";
        script.onload = function () {
            finish(true);
        };
        script.onerror = function () {
            finish(false);
        };
        try {
            (host.document.head || host.document.body).appendChild(script);
        } catch (_) {
            finish(false);
        }
    }
    function interfaceFontOptions(label: (key: string) => string): string[] {
        var names = [
            label("system"),
            "Roboto",
            "Roboto Condensed",
            "Caveat",
            "Liberation",
            "Gabriela",
            "PTSansNarrow",
        ];
        var doc = host.document;
        if (doc && doc.head && !doc.getElementById("ott-font-samples")) {
            var sheet = doc.createElement("style");
            sheet.id = "ott-font-samples";
            var source = doc.getElementById("ott-interface-style");
            var nonce =
                source && (source.nonce || source.getAttribute("nonce"));
            if (nonce) sheet.setAttribute("nonce", nonce);
            // Only the seven app-owned web/native families enter these rules.
            // Classes survive detail/grid snapshots without serialized inline CSS.
            sheet.textContent = names
                .map(function (name, i) {
                    var family = host.__ottNativeFontFamilies
                        ? host.__ottNativeFontFamilies[i]
                        : i
                          ? name.replace(" ", "")
                          : "Helvetica, Arial, sans-serif";
                    return ".ott-font-" + i + "{font-family:" + family + "}";
                })
                .join("\n");
            doc.head.appendChild(sheet);
        }
        return (
            host.__ottNativeFontOptions ||
            names.map(function (name, i) {
                return '<span class="ott-font-' + i + '">' + name + "</span>";
            })
        );
    }
    function interfaceSettings(): void {
        var ui = host.__ottAppearanceHost;
        var windowSettings =
            host.__ottMenuRegistry &&
            typeof host.__ottMenuRegistry.windowSettings === "function" &&
            host.__ottMenuRegistry.windowSettings(host);
        var showPlayerChoice =
            host.ott_device !== "lg/webos" &&
            !(host.ott_device === "pc2" && typeof host.videojs === "function");
        /**
         * Persist all interface settings and re-apply them.
         * Conditionally saves PiP, OSD opacity, volume step, and editor
         * settings based on capability. Calls all apply-functions after saving.
         */
        var page = ui.page(
            host,
            "settingsInterface",
            "Interface settings",
            true,
            false
        );
        var choice = page.choice;
        var label = page.label;
        var colorRow: any = {
            name: label("Interface colors"),
            settingId: "uiColorConfig",
            values: openColors,
        };
        Object.defineProperty(colorRow, "cur", {
            get: function () {
                return label(colorRow.val ? "Custom" : "Inherited");
            },
        });

        var mediaLanguageCodes = Object.keys(ui.languages);
        var mediaLanguageLabels = mediaLanguageCodes.map(function (code) {
            return ui.languages[code];
        });
        var noyes = [label("no"), label("yes")];
        var fontScales: number[] = [];
        // Include exact remote values while keeping the selector ascending.
        for (var scale = 20; scale <= 200; scale++)
            if (scale % 10 === 0 || scale === host.sUiFontScale)
                fontScales.push(scale);
        var tz = (host.arrTimezone || ["system", "0"]).slice();
        tz[0] = host._(tz[0]) || tz[0];
        ui.list(
            host,
            page.rows([
                choice(label("Interface mode"), "interfaceMode", [
                    label("Classic"),
                    label("Modern"),
                ]),
                choice(host._("Interface theme"), "interfaceTheme", [
                    host._("Classic"),
                    "PLi-HD",
                    "Studio 2026",
                ]),
                {
                    name: label("Preferred audio language"),
                    settingId: "preferredAudioLanguage",
                    settingValues: [""].concat(mediaLanguageCodes),
                    values: [label("Player default")].concat(
                        mediaLanguageLabels
                    ),
                },
                {
                    name: label("Preferred subtitle language"),
                    settingId: "preferredSubtitleLanguage",
                    settingValues: ["", "off"].concat(mediaLanguageCodes),
                    values: [label("Player default"), label("Off")].concat(
                        mediaLanguageLabels
                    ),
                },
                {
                    cur: label("select"),
                    name: label("Subtitle appearance"),
                    val: 0,
                    values: host.settingsSubtitles,
                },
                choice(
                    label("Black screen while switching the channel"),
                    "stopPlay",
                    noyes
                ),
                choice(label("PiP window size"), "pipSize", [
                    label("small"),
                    label("medium"),
                    label("large"),
                ]),
                choice(label("PiP window position"), "pipPosition", [
                    label("top-right"),
                    label("bottom-right"),
                    label("left-bottom"),
                    label("top-left"),
                ]),
                choice(
                    label("Font type"),
                    "fontSize",
                    interfaceFontOptions(label)
                ),
                choice(label("Timezone"), "timezone", tz),
                {
                    name: label("Font size") + ", %",
                    settingId: "uiFontScale",
                    settingValues: fontScales,
                    values: fontScales.map(function (value) {
                        return value + "%";
                    }),
                },
                choice(label("Sleep timer"), "sleepTimeout", [
                    label("Off"),
                    label("30 minutes"),
                    label("1 hour"),
                    label("2 hours"),
                    label("3 hours"),
                ]),
                choice(label("Interface transparency"), "osdOpacity", [
                    "100%",
                    "90%",
                    "80%",
                    "70%",
                    "60%",
                    "50%",
                    "40%",
                    "30%",
                    "20%",
                    "10%",
                    "0%",
                ]),
                {
                    name: label("Volume step, %"),
                    settingId: "volumeStep",
                    settingOffset: 3,
                    values: [3, 4, 5, 6, 7, 8, 9, 10],
                },
                colorRow,
                choice(
                    label("Permanent clock on screen"),
                    "permanentTime",
                    noyes.concat([label("transparent")])
                ),
                choice(
                    label("Graphical indication"),
                    "useGraphicalIndicators",
                    noyes
                ),
                choice(
                    label("Position shift -10 seconds after pause"),
                    "resumeWithTenSecondRewind",
                    noyes
                ),
                choice(
                    label("Remember previous channels"),
                    "prevCount",
                    [1, 5, 10, 15, 20]
                ),
                choice(label("History in Media Library"), "medCount", [
                    label("no"),
                    10,
                    20,
                    30,
                    40,
                    50,
                ]),
                choice(label("Editor"), "editor", [
                    label("built-in"),
                    label("native"),
                ]),
                choice(
                    label("Type of player for streaming"),
                    "players",
                    host.playerModeNames
                ),
                {
                    name: label("Maximum video height") + " (HLS/Shaka)",
                    settingId: "streamMaxHeight",
                    settingValues: [0, 360, 480, 720, 1080, 2160],
                    values: [
                        label("Automatic"),
                        "360p",
                        "480p",
                        "720p",
                        "1080p",
                        "2160p",
                    ],
                },
                {
                    name: label("Maximum stream bitrate") + " (HLS/Shaka)",
                    settingId: "streamMaxBitrate",
                    settingValues: [
                        0, 1000000, 2000000, 4000000, 8000000, 16000000,
                    ],
                    values: [
                        label("Automatic"),
                        "1 Mbps",
                        "2 Mbps",
                        "4 Mbps",
                        "8 Mbps",
                        "16 Mbps",
                    ],
                },
                {
                    name: label("Live recovery attempts"),
                    settingId: "liveRecoveryAttempts",
                    settingValues: [0, 1, 2, 3, 4, 5],
                    values: [label("Off"), 1, 2, 3, 4, 5],
                },
                {
                    name: label("Live stall timeout, s"),
                    settingId: "liveRecoveryTimeout",
                    settingValues: [10, 15, 20, 30],
                    values: [10, 15, 20, 30],
                },
                choice(label("Buffer Size, s"), "bufSize", host.bufferSizes),
            ])
        );
        ui.list(
            host,
            host.listArray.filter(function (row: any): boolean {
                if (
                    row.settingId === "preferredAudioLanguage" ||
                    row.settingId === "preferredSubtitleLanguage"
                )
                    return (
                        !!host.__ottCoreTransport &&
                        host.stbPlay === host.__ottCoreTransport.play
                    );
                if (row.settingId === "players") {
                    if (Array.isArray(host.stbPlayers))
                        row.values = host.stbPlayers;
                    return showPlayerChoice;
                }
                if (row.settingId === "bufSize") {
                    if (host.stbBufferSizes) row.values = host.stbBufferSizes;
                    return typeof host.stbSetBuffer === "function";
                }
                if (row.settingId === "editor")
                    return typeof host.showEditKey2 === "function";
                if (row.settingId === "medCount")
                    return (
                        typeof host.getMediaArray === "function" ||
                        !!(
                            host.__ottNasLibrary &&
                            host.__ottNasLibrary.available()
                        )
                    );
                if (row.settingId === "volumeStep")
                    return typeof host.stbGetVolume === "function";
                if (row.settingId === "osdOpacity")
                    return typeof host.stbSetOsdOpacity === "function";
                if (
                    row.settingId === "pipSize" ||
                    row.settingId === "pipPosition"
                )
                    return typeof host.stbPlayPip === "function";
                return true;
            })
        );
        // Native actions apply immediately and never enter the settings draft.
        if (windowSettings)
            windowSettings.rows.forEach(function (row: any, index: number) {
                host.listArray.splice(2 + index, 0, row);
            });
        page.attach();
        if (windowSettings) windowSettings.bindOwner();
    }
    host.__ottSubtitleAppearance = {
        apply: apply,
        declarations: declarations,
        interface: interfaceSettings,
        open: open,
        scaleFonts: scaleFonts,
    };
})(window as any);
