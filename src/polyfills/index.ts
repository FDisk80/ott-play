/** Application-specific compatibility; standard APIs come from runtime-polyfills.js. */
import { applyWebRuntimePolyfills } from "./runtime";

var polyfillsApplied = false;

/** Preserve the selected application timezone when initialization repeats. */
export function applyPolyfills(): void {
    if (polyfillsApplied) return;
    polyfillsApplied = true;
    applyWebRuntimePolyfills();
    polyfillDateTimezone();
}

/**
 * Polyfill custom timezone-offset support on `Date` (legacy STB feature).
 *
 * @remarks
 * Adds a `timezoneOffset` property to Date instances and a set of static /
 * instance methods (`Date.setTimezoneOffset`, `Date.getTimezoneOffset`,
 * `Date.prototype.toString`, etc.). A null override preserves native system
 * timezone rules; numeric overrides shift UTC getters/setters by fixed minutes.
 *
 * With a numeric override, `Date.prototype.toString` outputs UTC time shifted
 * by the stored offset.
 *
 * With a numeric override, the `get*` / `set*` method pairs (Milliseconds,
 * Seconds, Minutes, Hours, Date, Month, FullYear, Year, Day) use UTC
 * equivalents adjusted by the custom offset. System mode delegates to the
 * original local methods, including their per-date DST and setter semantics.
 *
 * @sideEffects
 * - Adds `Date.prototype.timezoneOffset` (default null = native system rules)
 * - Adds `Date.setTimezoneOffset(offset)` / `Date.getTimezoneOffset()`
 * - Adds `Date.prototype.setTimezoneOffset(offset)` / `Date.prototype.getTimezoneOffset()`
 * - Overrides `Date.prototype.toString()`
 * - Overrides all `Date.prototype.get*` / `set*` date/time accessors
 */
function polyfillDateTimezone(): void {
    var nativeGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    var nativeToString = Date.prototype.toString;
    (Date as any).nativeGetTimezoneOffset = nativeGetTimezoneOffset;
    var baseDate = new Date();
    (Date.prototype as any).timezoneOffset = null;
    (Date as any).setTimezoneOffset = function (
        offset: number | null
    ): number | null {
        return ((this as any).prototype.timezoneOffset = offset);
    };
    (Date.prototype as any).setTimezoneOffset = function (
        offset: number | null
    ): number | null {
        return ((this as any).timezoneOffset = offset);
    };
    (Date as any).getTimezoneOffset = function (_offset?: number): number {
        var offset = (this as any).prototype.timezoneOffset;
        return offset === null
            ? nativeGetTimezoneOffset.call(new Date())
            : offset;
    };
    (Date.prototype as any).getTimezoneOffset = function (): number {
        var offset = (this as any).timezoneOffset;
        return offset === null ? nativeGetTimezoneOffset.call(this) : offset;
    };
    (Date.prototype as any).toString = function (): string {
        if ((this as any).timezoneOffset === null)
            return nativeToString.call(this);
        var offsetMs = (this as any).timezoneOffset * 60 * 1000;
        baseDate.setTime(this.getTime() - offsetMs);
        return baseDate.toUTCString();
    };
    var dateParts = [
        "Milliseconds",
        "Seconds",
        "Minutes",
        "Hours",
        "Date",
        "Month",
        "FullYear",
        "Year",
        "Day",
    ];
    dateParts.forEach(function (part: string) {
        var nativeGet = (Date.prototype as any)["get" + part];
        var nativeSet = (Date.prototype as any)["set" + part];
        (Date.prototype as any)["get" + part] = function () {
            if ((this as any).timezoneOffset === null)
                return nativeGet.call(this);
            var offsetMs = (this as any).timezoneOffset * 60 * 1000;
            baseDate.setTime(this.getTime() - offsetMs);
            return (baseDate as any)["getUTC" + part]();
        };
        (Date.prototype as any)["set" + part] = function (value: number) {
            if ((this as any).timezoneOffset === null)
                return nativeSet.apply(this, arguments);
            var offsetMs = (this as any).timezoneOffset * 60 * 1000;
            baseDate.setTime(this.getTime() - offsetMs);
            (baseDate as any)["setUTC" + part](value);
            var result = baseDate.getTime() + offsetMs;
            this.setTime(result);
            return result;
        };
    });
}

// Run after the shared web runtime and before application modules.
applyPolyfills();
