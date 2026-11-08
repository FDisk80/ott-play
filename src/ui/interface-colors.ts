import {
    InterfaceColorPalette,
    parseInterfaceColorConfig,
    resolveInterfaceColors,
} from "../settings/interface-colors";
import { epgTimeCssColor, hsvToRgb } from "./index";

/** Preview values only. Rendering emits explicit overrides, never these fallbacks. */
export function interfaceColorPreview(values: any): InterfaceColorPalette {
    values = values || {};
    function hex(rgb: number[]): string {
        return (
            "#" +
            rgb
                .map(function (part) {
                    return ("0" + part.toString(16)).slice(-2);
                })
                .join("")
                .toUpperCase()
        );
    }
    function hsv(value: any, fallback: string, brightness?: number): string {
        var pair = (
            typeof value === "string" && /^\d{1,3},\d{1,3}$/.test(value)
                ? value
                : fallback
        ).split(",");
        return hex(
            hsvToRgb(
                Number(pair[0]),
                brightness ? Number(pair[1]) : 100,
                brightness || Number(pair[1])
            )
        );
    }
    var modern = Number(values.interfaceMode) === 1;
    var studio = Number(values.interfaceTheme) === 2;
    var pli = Number(values.interfaceTheme) === 1;
    var background = modern
        ? "#22282A"
        : studio
          ? "#0E1114"
          : pli
            ? "#000000"
            : hsv(values.highlightColorB, "255,0");
    var text = modern ? "#F5F6F6" : studio ? "#F0F3F1" : "#F0F0F0";
    var accent = modern
        ? "#EAB52D"
        : studio
          ? "#8BDDB8"
          : pli
            ? "#FCC000"
            : hsv(values.highlightColor, "50,85", 100);
    var epg = epgTimeCssColor(values.epgTimeColor);
    var rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(epg);
    epg = rgb
        ? hex([Number(rgb[1]), Number(rgb[2]), Number(rgb[3])])
        : /^#[0-9a-f]{6}$/i.test(epg)
          ? epg.toUpperCase()
          : text;
    var result = resolveInterfaceColors(values.uiColorConfig || "", {
        accent: accent,
        background: background,
        border: modern
            ? "#555B69"
            : studio
              ? "#2B3430"
              : pli
                ? "#555555"
                : accent,
        epgTime: epg,
        muted: modern ? "#B9BEC1" : studio ? "#A3AFA9" : "#A8A8B8",
        // Modern catalogue cards have their own contrast treatment; the preview
        // represents the common settings/menu row when a role is inherited.
        selection: modern
            ? "#F5F5F7"
            : studio
              ? "#E7F1EB"
              : pli
                ? "#303240"
                : hsv(values.highlightColorSel, "240,25", 50),
        selectionText: modern ? "#15171D" : studio ? "#112119" : accent,
        surface: modern ? "#303638" : studio ? "#1A2025" : background,
        text: text,
    });
    var custom = parseInterfaceColorConfig(values.uiColorConfig || "");
    // Classic/PLi render selected ink from curColor. Studio and Modern have
    // explicit contrasting selected-ink rules, independent of the accent.
    if (!modern && !studio && !(custom && custom.colors.selectionText))
        result.selectionText = result.accent;
    if (!modern && !studio && !pli && !(custom && custom.colors.border))
        result.border = result.accent;
    if (
        epgTimeCssColor(values.epgTimeColor) === "inherit" &&
        !(custom && custom.colors.epgTime)
    )
        result.epgTime = result.text;
    return result;
}

/** Convert a #RRGGBB value already validated by parseInterfaceColorConfig. */
export function interfaceColorRgb(hex: string): string {
    var rgb = parseInt(hex.slice(1), 16);
    return (rgb >> 16) + "," + ((rgb >> 8) & 255) + "," + (rgb & 255);
}

/** A finite selector/declaration vocabulary; no user-provided CSS is accepted.
 * Literal colors cover old Classic engines without CSS custom properties.
 * Both mode scopes stay installed, including asynchronous Modern admission.
 */
export function interfaceColorRules(raw: string, opacity: number): string {
    var config = parseInterfaceColorConfig(raw);
    if (!config) return "";
    var colors = config.colors;
    var rules: string[] = [];
    // The repeated class deliberately outranks existing theme + selected rules.
    var scope = "body.ott-custom-colors.ott-custom-colors";
    function rule(
        selectors: string,
        property: string,
        value: string | undefined
    ): void {
        if (!value) return;
        rules.push(
            scope +
                selectors.replace(/,/g, "," + scope) +
                "{" +
                property +
                ":" +
                value +
                " !important;}"
        );
    }
    function color(selectors: string, value: string | undefined): void {
        rule(selectors, "color", value);
    }
    function background(selectors: string, value: string | undefined): void {
        rule(selectors, "background-color", value);
    }
    var modern = ".interface-modern ";
    var vars = {
        accent: "accent",
        background: "surface",
        muted: "muted",
        surface: "panel",
        text: "text",
    };
    Object.keys(vars).forEach(function (key) {
        var value = colors[key as keyof InterfaceColorPalette];
        if (value)
            rule(
                ".interface-modern",
                "--modern-" + vars[key as keyof typeof vars],
                value
            );
    });
    background(" .list_back," + modern + "#list", colors.background);
    background(
        " #listCaption, #listPodval, #listTime, #listDetail, #listDetail #_nextpr, #listAbout, #listEdit, #listPopUp, #dialogbox, #numprog, #listEdit #ee, #listEdit input#editvar, #listEdit .osk-key:not(.ott-selected), #listAbout .osk-key:not(.ott-selected), #listIn .item:not(.ott-selected) .btn," +
            modern +
            ".modern-rail-action," +
            modern +
            ".modern-hero-action," +
            modern +
            "#listIn .modern-card," +
            modern +
            "#listIn .modern-channel," +
            modern +
            "#mediaPlaybackControls",
        colors.surface
    );
    var osd = colors.surface || colors.background;
    if (osd) {
        var rgb = interfaceColorRgb(osd);
        // Keep video visible through the panel without fading its contents.
        rule(
            modern + "#modernPlayer .modern-player-panel",
            "background",
            "rgba(" + rgb + ",0.72)"
        );
        background(" .osd", "rgba(" + rgb + "," + opacity / 100 + ")");
    }
    color(
        ", #list, #listCaption, #listDetail, #listAbout, #listEdit, #listEdit .osk-cap, #listEdit input#editvar, #listIn .item:not(.ott-selected) .btn, #listPopUp, #dialogbox, #numprog, #info1, #modernPlayer, #modernHero, #listIn .item:not(.ott-selected)," +
            modern +
            ".modern-title," +
            modern +
            ".modern-player-elapsed",
        colors.text
    );
    color(
        " #listTime, #listPodval, .ott-channel-programme, .ott-channel-description, .ott-channel-no-epg, .ott-channel-detail-time, #nprogramm_name, #nbegin_time, #nend_time, #channel_number, #data," +
            modern +
            ".modern-meta," +
            modern +
            ".modern-rail-action," +
            modern +
            ".modern-player-remaining," +
            modern +
            ".modern-player-status",
        colors.muted
    );
    color(
        " .ott-epg-current-title, .ott-epg-detail-title, #listDetail .ott-channel-detail-accent, #programm_name2, .interface-credits a," +
            modern +
            ".modern-player-status-action",
        colors.accent
    );
    background(
        " #progress, .ott-channel-progress-fill," +
            modern +
            ".modern-progress > span," +
            modern +
            ".modern-player-primary",
        colors.accent
    );
    rule(
        " #listCaption, #listPodval, #listPopUp, #dialogbox, #info1, #numprog, #listIn .item," +
            modern +
            ".modern-rail-action," +
            modern +
            ".modern-hero-action, #listEdit input, #listEdit button",
        "border-color",
        colors.border
    );
    color(" .ott-epg-time", colors.epgTime);
    // Selected ink is independent of accent, including subsequently created rows.
    var selected =
        ' #dialogbox .ott-selected, #listPopUp .ott-selected, #numprog [aria-pressed="true"], #listEdit .ott-selected, #listAbout .ott-selected,' +
        modern +
        ".modern-rail-action.ott-selected," +
        modern +
        ".modern-rail-action.modern-rail-selected," +
        modern +
        ".modern-rail-action:focus," +
        modern +
        ".modern-hero-action:focus," +
        modern +
        ".modern-player-action:focus";
    color(
        " #listIn .item.ott-selected, #listIn .item.ott-selected *," + selected,
        colors.selectionText
    );
    // A settings action nests a .btn with its own dark fill. It must use the
    // selected row's surface when custom selected ink would otherwise be hidden.
    rule(
        " #listIn .item.ott-selected .btn, #listEdit .ott-selected .btn, #listAbout .ott-selected .btn",
        "background",
        colors.selection || (colors.selectionText ? "inherit" : undefined)
    );
    color(
        " #dialogbox .ott-color-selected, #dialogbox .ott-color-selected *",
        colors.selectionText
    );
    background(
        " #dialogbox .ott-color-selected, #dialogbox .ott-color-selected .btn",
        colors.selection
    );
    background(" #listIn .item.ott-selected," + selected, colors.selection);
    return rules.join("\n");
}

/** Own only this style element/class. Reset exposes the original theme again. */
export function applyInterfaceColors(
    doc: Document,
    raw: string,
    opacity: number
): void {
    var css = interfaceColorRules(raw, opacity);
    var style = doc.getElementById(
        "ott-interface-colors-style"
    ) as HTMLStyleElement | null;
    if (!css) {
        if (style && style.parentNode) style.parentNode.removeChild(style);
        if (doc.body) doc.body.classList.remove("ott-custom-colors");
        return;
    }
    if (!doc.head || !doc.body) return;
    if (!style) {
        style = doc.createElement("style");
        style.id = "ott-interface-colors-style";
        // Tauri authors this exact style with its style-src nonce. Script nonces
        // are a different policy authority and must not be borrowed.
        var source = doc.getElementById("ott-interface-style");
        var nonce =
            source &&
            ((source as HTMLStyleElement).nonce ||
                source.getAttribute("nonce"));
        if (nonce) style.setAttribute("nonce", nonce);
        style.textContent = css;
        doc.head.appendChild(style);
    } else if (style.textContent !== css) style.textContent = css;
    doc.body.classList.add("ott-custom-colors");
}
