/** Lazy interface color editor. Persistence stays with the owning settings draft. */
(function (host: any): void {
    var roles = [
        "background",
        "surface",
        "text",
        "muted",
        "accent",
        "selection",
        "selectionText",
        "border",
        "epgTime",
    ];
    var names = [
        "Background color",
        "Surface color",
        "Text color",
        "Secondary text color",
        "Accent color",
        "Background color of selected item",
        "Selected text color",
        "Border color",
        "EPG time color",
    ];
    var palette = [
        "#FFFFFF",
        "#E2E8F0",
        "#94A3B8",
        "#475569",
        "#1E293B",
        "#0F172A",
        "#080C12",
        "#000000",
        "#FEE2E2",
        "#FCA5A5",
        "#EF4444",
        "#FB923C",
        "#FBBF24",
        "#FDE047",
        "#BEF264",
        "#22C55E",
        "#A7F3D0",
        "#2DD4BF",
        "#22D3EE",
        "#38BDF8",
        "#60A5FA",
        "#818CF8",
        "#A78BFA",
        "#C084FC",
        "#F9A8D4",
        "#F472B6",
        "#E879F9",
        "#7C3AED",
        "#1D4ED8",
        "#0E7490",
        "#166534",
        "#78350F",
    ];
    var presetNames = [
        "Midnight",
        "Ocean",
        "Warm graphite",
        "High contrast",
        "Light",
    ];
    var presets = [
        {
            values: [
                "#080C12",
                "#111B2B",
                "#F1F5F9",
                "#94A3B8",
                "#67E8F9",
                "#164E63",
                "#FFFFFF",
                "#334155",
                "#67E8F9",
            ],
        },
        {
            values: [
                "#061826",
                "#0C293D",
                "#EFFAFF",
                "#A3C4D5",
                "#5EEAD4",
                "#155E75",
                "#FFFFFF",
                "#3B6C83",
                "#5EEAD4",
            ],
        },
        {
            values: [
                "#171412",
                "#29231F",
                "#FFF7ED",
                "#C9B9A7",
                "#FDBA74",
                "#78350F",
                "#FFFFFF",
                "#685649",
                "#FDE68A",
            ],
        },
        {
            values: [
                "#000000",
                "#000000",
                "#FFFFFF",
                "#E5E5E5",
                "#FFFF00",
                "#FFFF00",
                "#000000",
                "#FFFFFF",
                "#FFFF00",
            ],
        },
        {
            values: [
                "#F5F7FA",
                "#FFFFFF",
                "#111827",
                "#475569",
                "#1D4ED8",
                "#DBEAFE",
                "#102A56",
                "#64748B",
                "#1D4ED8",
            ],
        },
    ];
    function label(value: string): string {
        return (host._ && host._(value)) || value;
    }
    function copy(source: any): any {
        var result: any = {};
        roles.forEach(function (role) {
            if (source && Object.prototype.hasOwnProperty.call(source, role))
                result[role] = source[role];
        });
        return result;
    }
    function open(editor: any): boolean {
        var port = host.__ottClassicScreenPort;
        var bridge = host.__ottInterfaceColors;
        var values = host.__ottColorValues;
        var doc = host.document;
        var panel = doc && doc.getElementById("listAbout");
        var parent = port && port.listOwner();
        if (
            !editor ||
            editor !== host.__ottSettingsEditor ||
            !editor.active() ||
            !parent ||
            !parent.foreground() ||
            typeof port.dispatch !== "function" ||
            !panel ||
            !bridge ||
            !values ||
            typeof host.showEditKey !== "function" ||
            typeof host.saveListPanelState !== "function"
        )
            return false;
        var parsed = bridge.parse(editor.get("uiColorConfig"));
        var colors = copy(parsed && parsed.colors);
        var selected = "text";
        var owner: any = null;
        var closed = false;
        var rows: HTMLButtonElement[][] = [];
        var focusRow = 0,
            focusColumn = 0;
        var root: HTMLElement;
        var error = "";
        var focusTimer: any = null;
        function active(): boolean {
            return (
                !closed &&
                editor === host.__ottSettingsEditor &&
                editor.active() &&
                parent.active() &&
                (!owner || owner.active())
            );
        }
        function foreground(): boolean {
            return active() && !!owner && owner.foreground();
        }
        function effective(): any {
            var config: any = {};
            [
                "interfaceMode",
                "interfaceTheme",
                "highlightColor",
                "highlightColorSel",
                "highlightColorB",
                "epgTimeColor",
            ].forEach(function (id) {
                config[id] = editor.get(id);
            });
            config.uiColorConfig = bridge.serialize(colors);
            return bridge.resolve(config);
        }
        function element(tag: string, text?: string): HTMLElement {
            var node = doc.createElement(tag);
            if (text !== undefined) {
                node.textContent = text;
                node.setAttribute("dir", "auto");
            }
            return node;
        }
        function focus(): void {
            if (!foreground() || !rows.length) return;
            focusRow = Math.max(0, Math.min(rows.length - 1, focusRow));
            var row = rows[focusRow];
            focusColumn = Math.max(0, Math.min(row.length - 1, focusColumn));
            var button = row[focusColumn];
            button.focus();
            if (button.scrollIntoView) {
                try {
                    button.scrollIntoView({
                        block: "nearest",
                        inline: "nearest",
                    });
                } catch (_) {
                    button.scrollIntoView(false);
                }
            }
        }
        function laterFocus(): void {
            if (focusTimer !== null) host.clearTimeout(focusTimer);
            focusTimer = host.setTimeout(function () {
                focusTimer = null;
                focus();
            }, 0);
        }
        function group(
            parentNode: HTMLElement,
            columns: number,
            buttons: any[]
        ): void {
            var line: HTMLButtonElement[] = [];
            // Explicit visual rows match the remote navigation model even on
            // Classic WebViews without Flexbox, CSS grid or calc() support.
            var container = element("table");
            container.setAttribute("role", "presentation");
            container.setAttribute("dir", "ltr");
            container.style.width = "100%";
            container.style.tableLayout = "fixed";
            container.style.borderSpacing = ".3em";
            var body = element("tbody");
            var rowElement: HTMLElement;
            container.appendChild(body);
            parentNode.appendChild(container);
            buttons.forEach(function (item, index) {
                if (index % columns === 0) {
                    line = [];
                    rows.push(line);
                    rowElement = element("tr");
                    body.appendChild(rowElement);
                }
                var cell = element("td");
                cell.style.width = 100 / columns + "%";
                cell.style.padding = "0";
                cell.style.verticalAlign = "middle";
                rowElement.appendChild(cell);
                var rowIndex = rows.length - 1,
                    columnIndex = line.length;
                var button = element("button", item.text) as HTMLButtonElement;
                button.type = "button";
                button.className = "btn";
                button.style.margin = "0";
                button.style.boxSizing = "border-box";
                button.style.width = "100%";
                button.style.minWidth = "0";
                button.style.whiteSpace = "normal";
                button.setAttribute("data-color-action", item.id);
                if (item.ltr) button.dir = "ltr";
                if (item.pressed !== undefined)
                    button.setAttribute("aria-pressed", String(item.pressed));
                if (item.color) {
                    var swatch = element("span");
                    swatch.style.cssText =
                        "display:inline-block;width:1.3em;height:1.3em;border:1px solid currentColor;vertical-align:middle;";
                    swatch.style.backgroundColor = item.color;
                    button.textContent = "";
                    button.appendChild(swatch);
                    button.setAttribute(
                        "aria-label",
                        label(names[roles.indexOf(selected)]) +
                            ": " +
                            item.color
                    );
                    button.title = item.color;
                }
                button.onclick = function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!foreground() || !panel.contains(button)) return;
                    focusRow = rowIndex;
                    focusColumn = columnIndex;
                    item.action();
                };
                button.onfocus = function () {
                    focusRow = rowIndex;
                    focusColumn = columnIndex;
                };
                line.push(button);
                cell.appendChild(button);
            });
        }
        function redraw(): void {
            if (!active()) return;
            var resolved = effective();
            var current = values.normalizeHex(resolved[selected]) || "#FFFFFF";
            rows = [];
            panel.textContent = "";
            root = element("div");
            root.setAttribute("data-ott-color-appearance", "");
            root.setAttribute("role", "region");
            root.setAttribute("aria-label", label("Interface colors"));
            root.style.cssText =
                "max-width:58em;height:100%;box-sizing:border-box;overflow:auto;margin:auto;padding:.4em .6em;";
            panel.appendChild(root);
            root.appendChild(
                element(
                    "p",
                    label(
                        "Apply changes to this draft, then use Save Settings."
                    )
                )
            );
            group(
                root,
                3,
                roles.map(function (role, i) {
                    return {
                        action: function () {
                            selected = role;
                            error = "";
                            redraw();
                            focus();
                        },
                        id: "role-" + role,
                        pressed: selected === role,
                        text: label(names[i]),
                    };
                })
            );
            var sample = element("div");
            sample.setAttribute("data-color-preview", "");
            sample.style.cssText =
                "margin:.5em .15em;padding:.6em;border:2px solid;";
            sample.style.backgroundColor = resolved.background;
            sample.style.color = resolved.text;
            sample.style.borderColor = resolved.border;
            var title = element("strong", label("Preview"));
            title.style.color = resolved.accent;
            sample.appendChild(title);
            var normal = element("div", "1  ·  " + label("Channel list"));
            normal.style.backgroundColor = resolved.surface;
            normal.style.padding = ".3em";
            sample.appendChild(normal);
            var chosen = element("div", "2  ·  " + label("Selected item"));
            chosen.style.backgroundColor = resolved.selection;
            chosen.style.color = resolved.selectionText;
            chosen.style.padding = ".3em";
            sample.appendChild(chosen);
            var description = element("div", label("Description"));
            description.style.color = resolved.muted;
            sample.appendChild(description);
            var time = element("span", "20:30");
            time.setAttribute("dir", "ltr");
            time.style.color = resolved.epgTime || resolved.text;
            sample.appendChild(time);
            root.appendChild(sample);
            var state = element(
                "div",
                label(names[roles.indexOf(selected)]) +
                    ": " +
                    current +
                    " · " +
                    label(
                        Object.prototype.hasOwnProperty.call(colors, selected)
                            ? "Custom"
                            : "Inherited"
                    )
            );
            state.setAttribute("aria-live", "polite");
            root.appendChild(state);
            root.appendChild(element("div", label("Palette")));
            group(
                root,
                8,
                palette.map(function (hex) {
                    return {
                        action: function () {
                            colors[selected] = hex;
                            error = "";
                            redraw();
                            focus();
                        },
                        color: hex,
                        id: "swatch-" + hex.slice(1),
                        pressed: current === hex,
                    };
                })
            );
            var rgb = values.hexToRgb(current),
                hsv = values.hexToHsv(current);
            function pretty(n: number): string {
                return String(Math.round(n * 1000) / 1000);
            }
            group(root, 3, [
                {
                    action: function () {
                        edit("HEX", current);
                    },
                    id: "hex",
                    ltr: true,
                    text: "HEX " + current,
                },
                {
                    action: function () {
                        edit("RGB", [rgb.r, rgb.g, rgb.b].join(", "));
                    },
                    id: "rgb",
                    ltr: true,
                    text: "RGB " + [rgb.r, rgb.g, rgb.b].join(", "),
                },
                {
                    action: function () {
                        edit(
                            "HSV",
                            [pretty(hsv.h), pretty(hsv.s), pretty(hsv.v)].join(
                                ", "
                            )
                        );
                    },
                    id: "hsv",
                    ltr: true,
                    text:
                        "HSV " +
                        [pretty(hsv.h), pretty(hsv.s), pretty(hsv.v)].join(
                            ", "
                        ),
                },
            ]);
            group(root, 1, [
                {
                    action: function () {
                        delete colors[selected];
                        error = "";
                        redraw();
                        focus();
                    },
                    id: "inherit",
                    text: label("Use inherited color"),
                },
            ]);
            root.appendChild(element("div", label("Color schemes")));
            group(
                root,
                4,
                presets.map(function (preset, index) {
                    return {
                        action: function () {
                            colors = {};
                            roles.forEach(function (role, i) {
                                colors[role] = preset.values[i];
                            });
                            error = "";
                            redraw();
                            focus();
                        },
                        id: "scheme-" + index,
                        text: label(presetNames[index]),
                    };
                })
            );
            var feedback = element("p", error);
            feedback.setAttribute("role", "status");
            feedback.setAttribute("aria-live", "polite");
            root.appendChild(feedback);
            group(root, 3, [
                { action: apply, id: "apply", text: label("Apply") },
                { action: close, id: "cancel", text: label("Cancel") },
                {
                    action: function () {
                        colors = {};
                        error = "";
                        redraw();
                        focus();
                    },
                    id: "reset",
                    text: label("Reset to default"),
                },
            ]);
        }
        function edit(format: string, initial: string): void {
            if (!foreground()) return;
            var role = selected;
            host.editCaption =
                label(names[roles.indexOf(role)]) +
                " · " +
                (format === "HSV"
                    ? label("Hue") +
                      ", " +
                      label("Saturation") +
                      ", " +
                      label("Brightness")
                    : format) +
                (format === "RGB"
                    ? " (0–255, 0–255, 0–255)"
                    : format === "HSV"
                      ? " (0–360, 0–100, 0–100)"
                      : " (#RRGGBB)");
            host.editvar = initial;
            host.setEdit = function () {
                if (!foreground()) return;
                var text = String(host.editvar || "").trim();
                var hex: string | null = null;
                if (text.length <= 104) {
                    if (format === "HEX") hex = values.normalizeHex(text);
                    else {
                        var parts = text.split(",").map(function (
                            part: string
                        ) {
                            return part.trim();
                        });
                        if (parts.length === 3) {
                            var result =
                                format === "RGB"
                                    ? values.parseRgb(
                                          parts[0],
                                          parts[1],
                                          parts[2]
                                      )
                                    : values.parseHsv(
                                          parts[0],
                                          parts[1],
                                          parts[2]
                                      );
                            if (result)
                                hex =
                                    format === "RGB"
                                        ? values.rgbToHex(result)
                                        : values.hsvToHex(result);
                        }
                    }
                }
                if (hex) {
                    colors[role] = hex;
                    error = "";
                } else error = label("Invalid color value");
                redraw();
                laterFocus();
            };
            host.showEditKey(host.keys.ENTER);
            ["editvar", "ee"].forEach(function (id) {
                var input = doc.getElementById(id);
                if (input) input.setAttribute("dir", "ltr");
            });
        }
        function close(): void {
            if (!active()) return;
            closed = true;
            if (focusTimer !== null) host.clearTimeout(focusTimer);
            // Focus the outgoing owner before hide so the shared modal observer
            // can restore the Interface row rather than a detached child button.
            panel.focus();
            host.$(panel).hide().text("");
            host.restoreListPanelState();
            if (host.showPage) host.showPage();
        }
        function apply(): void {
            if (!foreground()) return;
            var encoded = bridge.serialize(colors);
            if (encoded === null || !editor.set("uiColorConfig", encoded)) {
                error = label("Settings could not be saved");
                redraw();
                focus();
                return;
            }
            close();
        }
        function handle(key: number): boolean {
            if (!foreground()) return false;
            var keys = host.keys;
            if (key === keys.RETURN || key === keys.EXIT) {
                close();
                return true;
            }
            if (key === keys.GREEN) {
                apply();
                return true;
            }
            if (key === keys.ENTER) {
                var row = rows[focusRow];
                if (row && row[focusColumn]) row[focusColumn].click();
                return true;
            }
            if (key === keys.LEFT) focusColumn--;
            else if (key === keys.RIGHT) focusColumn++;
            else if (key === keys.UP) focusRow--;
            else if (key === keys.DOWN) focusRow++;
            else return true;
            focus();
            return true;
        }
        function keydown(event: KeyboardEvent): void {
            if (!foreground()) return;
            var codes: any = {
                " ": host.keys.ENTER,
                ArrowDown: host.keys.DOWN,
                ArrowLeft: host.keys.LEFT,
                ArrowRight: host.keys.RIGHT,
                ArrowUp: host.keys.UP,
                Enter: host.keys.ENTER,
                Escape: host.keys.RETURN,
            };
            var key = codes[event.key];
            if (key !== undefined) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                // Keep the original physical event for the nested editor's
                // held-opening-key guard; _doKey synthesizes and loses it.
                port.dispatch(key, event, function () {});
            }
        }
        host.saveListPanelState();
        var caption = doc.getElementById("listCaption");
        if (caption) caption.textContent = label("Interface colors");
        var footer = doc.getElementById("listPodval");
        if (footer) {
            if (typeof host.renderButtonHint === "function")
                footer.innerHTML =
                    host.renderButtonHint(host.keys.GREEN, "", "Apply") +
                    host.renderButtonHint(
                        host.keys.RETURN,
                        host.strRETURN || "",
                        "Cancel"
                    );
            else footer.textContent = label("Apply") + " · " + label("Cancel");
        }
        var detail = doc.getElementById("listDetail");
        if (detail) detail.textContent = "";
        redraw();
        host.$(panel).show();
        var callback = port.setOwnedCallback("about", handle);
        owner = callback && callback.owner;
        if (!owner) {
            close();
            return false;
        }
        panel.addEventListener("keydown", keydown, true);
        owner.own(function () {
            closed = true;
            if (focusTimer !== null) host.clearTimeout(focusTimer);
            panel.removeEventListener("keydown", keydown, true);
        });
        focus();
        return true;
    }
    host.__ottColorAppearance = { open: open };
})(window as any);
