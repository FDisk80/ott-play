/** Canonical sRGB byte components; conversions never accept CSS expressions. */
interface RgbColor {
    readonly b: number;
    readonly g: number;
    readonly r: number;
}

/** Hue is degrees, saturation/value are percentages. Hue 360 equals zero. */
interface HsvColor {
    readonly h: number;
    readonly s: number;
    readonly v: number;
}

function colorNumber(value: number, maximum: number): boolean {
    return (
        typeof value === "number" &&
        isFinite(value) &&
        value >= 0 &&
        value <= maximum
    );
}

/** Accept exactly #RGB or #RRGGBB; callers own any intentional whitespace trim. */
function normalizeHex(value: string): string | null {
    if (
        typeof value !== "string" ||
        (value.length !== 4 && value.length !== 7) ||
        value.charAt(0) !== "#" ||
        /[^0-9a-f]/i.test(value.slice(1))
    )
        return null;
    var digits = value.slice(1).toUpperCase();
    if (digits.length === 3)
        digits =
            digits.charAt(0) +
            digits.charAt(0) +
            digits.charAt(1) +
            digits.charAt(1) +
            digits.charAt(2) +
            digits.charAt(2);
    return "#" + digits;
}

function rgbComponent(text: string): number | null {
    if (
        typeof text !== "string" ||
        text.length < 1 ||
        text.length > 3 ||
        /[^0-9]/.test(text)
    )
        return null;
    var value = Number(text);
    return colorNumber(value, 255) ? value : null;
}

function parseRgb(r: string, g: string, b: string): RgbColor | null {
    var red = rgbComponent(r),
        green = rgbComponent(g),
        blue = rgbComponent(b);
    if (red === null || green === null || blue === null) return null;
    return { b: blue, g: green, r: red };
}

function hsvComponent(text: string, maximum: number): number | null {
    if (typeof text !== "string" || text.length < 1 || text.length > 32)
        return null;
    // Comparing the full match also rejects a trailing newline (JS $ permits it).
    var match = /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.exec(text);
    if (!match || match[0] !== text) return null;
    var value = Number(text);
    return colorNumber(value, maximum) ? value : null;
}

/** Unsigned decimal text only, at most 32 characters per component. */
function parseHsv(h: string, s: string, v: string): HsvColor | null {
    var hue = hsvComponent(h, 360),
        saturation = hsvComponent(s, 100),
        value = hsvComponent(v, 100);
    if (hue === null || saturation === null || value === null) return null;
    return { h: hue === 360 ? 0 : hue, s: saturation, v: value };
}

function rgbToHex(rgb: RgbColor): string | null {
    if (!rgb) return null;
    var values = [rgb.r, rgb.g, rgb.b];
    var hex = "#";
    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (!colorNumber(value, 255) || Math.floor(value) !== value)
            return null;
        hex += ("0" + value.toString(16)).slice(-2).toUpperCase();
    }
    return hex;
}

function hexToRgb(value: string): RgbColor | null {
    var hex = normalizeHex(value);
    if (hex === null) return null;
    return {
        b: parseInt(hex.slice(5, 7), 16),
        g: parseInt(hex.slice(3, 5), 16),
        r: parseInt(hex.slice(1, 3), 16),
    };
}

/** Achromatic colors use hue zero; HSV values are not prematurely rounded. */
function hexToHsv(value: string): HsvColor | null {
    var rgb = hexToRgb(value);
    if (rgb === null) return null;
    var r = rgb.r / 255,
        g = rgb.g / 255,
        b = rgb.b / 255;
    var maximum = Math.max(r, g, b),
        minimum = Math.min(r, g, b);
    var delta = maximum - minimum,
        hue = 0;
    if (delta !== 0) {
        if (maximum === r) hue = (g - b) / delta + (g < b ? 6 : 0);
        else if (maximum === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue *= 60;
    }
    return {
        h: hue,
        s: maximum === 0 ? 0 : (delta / maximum) * 100,
        v: maximum * 100,
    };
}

function hsvToHex(hsv: HsvColor): string | null {
    if (
        !hsv ||
        !colorNumber(hsv.h, 360) ||
        !colorNumber(hsv.s, 100) ||
        !colorNumber(hsv.v, 100)
    )
        return null;
    var hue = (hsv.h === 360 ? 0 : hsv.h) / 60;
    var value = hsv.v / 100,
        chroma = value * (hsv.s / 100);
    var x = chroma * (1 - Math.abs((hue % 2) - 1));
    var offset = value - chroma;
    var channels =
        hue < 1
            ? [chroma, x, 0]
            : hue < 2
              ? [x, chroma, 0]
              : hue < 3
                ? [0, chroma, x]
                : hue < 4
                  ? [0, x, chroma]
                  : hue < 5
                    ? [x, 0, chroma]
                    : [chroma, 0, x];
    return rgbToHex({
        b: Math.round((channels[2] + offset) * 255),
        g: Math.round((channels[1] + offset) * 255),
        r: Math.round((channels[0] + offset) * 255),
    });
}

if (typeof window !== "undefined") {
    (window as any).__ottColorValues = {
        hexToHsv,
        hexToRgb,
        hsvToHex,
        normalizeHex,
        parseHsv,
        parseRgb,
        rgbToHex,
    };
}
