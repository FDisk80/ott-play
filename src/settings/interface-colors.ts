/** Client-only color overrides. Missing roles retain the active theme. */
export const interfaceColorRoles = [
    "background",
    "surface",
    "text",
    "muted",
    "accent",
    "selection",
    "selectionText",
    "border",
    "epgTime",
] as const;

export type InterfaceColorRole = (typeof interfaceColorRoles)[number];
export type InterfaceColorPalette = Partial<Record<InterfaceColorRole, string>>;
export interface InterfaceColorConfig {
    colors: InterfaceColorPalette;
    version: 1;
}

function normalizeColorRoles(colors: any): InterfaceColorPalette | null {
    if (!colors || typeof colors !== "object" || Array.isArray(colors))
        return null;
    var keys = Object.keys(colors);
    if (
        keys.length > interfaceColorRoles.length ||
        keys.some(function (key) {
            return interfaceColorRoles.indexOf(key as InterfaceColorRole) < 0;
        })
    )
        return null;
    var result: InterfaceColorPalette = {};
    for (var i = 0; i < interfaceColorRoles.length; i++) {
        var role = interfaceColorRoles[i];
        if (Object.prototype.hasOwnProperty.call(colors, role)) {
            var value = colors[role];
            if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))
                return null;
            result[role] = value.toUpperCase();
        }
    }
    return result;
}

/** Empty input is a valid inherited palette; null means the whole input is invalid. */
export function parseInterfaceColorConfig(
    raw: string
): InterfaceColorConfig | null {
    if (typeof raw !== "string" || raw.length > 2048) return null;
    if (raw === "") return { colors: {}, version: 1 };
    try {
        var config = JSON.parse(raw);
        if (
            !config ||
            Array.isArray(config) ||
            Object.keys(config).length !== 2 ||
            config.version !== 1 ||
            !Object.prototype.hasOwnProperty.call(config, "version") ||
            !Object.prototype.hasOwnProperty.call(config, "colors")
        )
            return null;
        var colors = normalizeColorRoles(config.colors);
        return colors ? { colors: colors, version: 1 } : null;
    } catch (_) {
        return null;
    }
}

export function normalizeInterfaceColorConfig(raw: string): string | null {
    var config = parseInterfaceColorConfig(raw);
    return config ? serializeInterfaceColors(config.colors) : null;
}

export function serializeInterfaceColors(
    colors: InterfaceColorPalette
): string | null {
    try {
        var normalized = normalizeColorRoles(colors);
        return normalized
            ? Object.keys(normalized).length
                ? // Field order is part of the byte-exact remote setting contract.
                  '{"version":1,"colors":' + JSON.stringify(normalized) + "}"
                : ""
            : null;
    } catch (_) {
        return null;
    }
}

/** Returns a detached palette; invalid persisted data contributes no overrides. */
export function resolveInterfaceColors(
    raw: string,
    basePalette: InterfaceColorPalette
): InterfaceColorPalette {
    var config = parseInterfaceColorConfig(raw);
    var result: InterfaceColorPalette = {};
    interfaceColorRoles.forEach(function (role) {
        if (Object.prototype.hasOwnProperty.call(basePalette, role))
            result[role] = basePalette[role];
        if (config && Object.prototype.hasOwnProperty.call(config.colors, role))
            result[role] = config.colors[role];
    });
    return result;
}
