import {
    createFavoritesPhysicalStorageGrant,
    createFavoritesPhysicalStorageRead,
    type FavoritesPhysicalStorageGrant,
    type FavoritesPhysicalStorageRead,
} from "./favorites-physical-storage";

/**
 * Storage abstraction layer.
 *
 * Ported from player.js (ottpStorage IIFE, laaMac, provider helpers).
 * Uses localStorage when available, falls back to cookies or session memory.
 * Provides provider-prefixed storage for multi-provider setups.
 *
 * Variable renaming from original JS:
 *   e → key        t → value       r → callback    s → location
 *   n → adapter    i → methodName  o → adapterObj  a → get
 *   c → set        u → del         d → has         p → hasValue
 *   f → clear      h → dump        y → getI        m → setI
 *   l → init       g → prefix
 */

// ---------------------------------------------------------------------------
// External globals (defined in index.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dynamic script loader
// ---------------------------------------------------------------------------

// loadJS and getScriptDOM defined in utils/helpers.ts

// ---------------------------------------------------------------------------
// LZ-String compression (declared here, defined in utils/lzstring.ts which is
// concatenated before storage/index.js by build-concat.cjs)
// ---------------------------------------------------------------------------

declare function compress(uncompressed: string): string;
declare function decompress(compressed: string): string | null;
/** Marker prefix for compressed values */
const LZ_MARKER = "\x01LZ\x01";

// ---------------------------------------------------------------------------
// Storage adapter (localStorage / cookie fallback)
// ---------------------------------------------------------------------------

export interface StorageAdapter {
    captureFavoritesPhysicalRead?(): FavoritesPhysicalStorageRead | null;
    captureFavoritesPhysicalStorage?(): FavoritesPhysicalStorageGrant | null;
    clear(): void;
    del(key: string): void;
    dump(): Record<string, string>;
    get(key: string): string | null;
    getI(key: string, defaultValue?: number): number;
    has(key: string): boolean;
    hasValue(key: string): boolean;
    localPlayback?: {
        active(): boolean;
        transient(): boolean;
        capture(): () => boolean;
        preview(
            identity: () => string
        ): { current(): boolean; commit(): boolean; discard(): void } | null;
        begin(identity: () => string): () => void;
        end(persist?: boolean, extra?: { key: string; value: string }): boolean;
        profile(
            writes: JournalWrite[],
            current: () => boolean,
            playback?: boolean
        ): boolean;
    };
    reset(): void;
    set(key: string, value: string): void;
    setI(key: string, value: number): void;
    transaction?(writes: JournalWrite[], current: () => boolean): boolean;
}

function createStorageAdapter(
    get: StorageAdapter["get"],
    set: StorageAdapter["set"],
    del: StorageAdapter["del"],
    clear: StorageAdapter["clear"],
    dump: StorageAdapter["dump"]
): StorageAdapter {
    return {
        clear,
        del,
        dump,
        get,
        getI(key: string, defaultValue = 0): number {
            const value = parseInt(get(key) || "", 10);
            return isNaN(value) ? defaultValue : value;
        },
        has(key: string): boolean {
            return get(key) !== null;
        },
        hasValue(key: string): boolean {
            return (get(key) || "") !== "";
        },
        reset(): void {},
        set,
        setI(key: string, value: number): void {
            set(key, String(value));
        },
    };
}

// -- localStorage implementation ------------------------------------------------

/**
 * Create a `StorageAdapter` backed by `window.localStorage`.
 *
 * @returns A `StorageAdapter` object with all required methods.
 *
 * @remarks
 * Storage access can fail after detection (privacy settings, quota). Failed
 * operations switch to cookies/memory for this session and preserve readable keys.
 */
const STORAGE_FALLBACK_KEYS = "ottplayStorageFallback";
const STORAGE_RESET_EPOCH = STORAGE_FALLBACK_KEYS + ".reset";
const STORAGE_COOKIE_ATTRIBUTES =
    "; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/";

/** Internal cookie bookkeeping must never be imported as a user setting. */
export function isStorageMetadataKey(key: string): boolean {
    return (
        key === "ottplaySettingsJournalV1" ||
        key === "local-favorite-path-proofs.v1" ||
        key === STORAGE_FALLBACK_KEYS ||
        key.indexOf(STORAGE_FALLBACK_KEYS + ".") === 0
    );
}

interface JournalWrite {
    after: string | null;
    before: string | null;
    key: string;
    rollback?: string | null;
}

let recoveryStorage: Storage | null = null;

/** A failed boot recovery quarantines every adapter until a fresh page loads. */
export function settingsRecoveryRequired(): boolean {
    return recoveryStorage !== null;
}

/** Called only by the recovery screen after an explicit user action. */
export function recoverStoredSettings(clear: boolean): void {
    var backing = recoveryStorage;
    if (!backing) return;
    if (!clear) {
        recoverSettingsJournal(backing);
        return;
    }
    var cookies = readStorageCookies(true);
    var cookieKeys = readStorageFallback(cookies) || [];
    var key = "ottplaySettingsJournalV1";
    // A reset must never become an undo on the next boot. Keep this invalid
    // journal as a durable barrier until native data and cookie policy reset.
    var barrier = '{"version":0}';
    backing.setItem(key, barrier);
    function ownsReset(): void {
        if (backing!.getItem(key) !== barrier)
            throw new Error("Settings journal changed");
    }
    ownsReset();
    var names: string[] = [];
    for (var i = 0; i < backing.length; i++) {
        var name = backing.key(i);
        if (name !== null && name !== key) names.push(name);
    }
    names.forEach(function (name) {
        if (cookieKeys.indexOf(name) < 0) cookieKeys.push(name);
    });
    Object.keys(cookies).forEach(function (name) {
        if (isStorageMetadataKey(name) && name !== STORAGE_RESET_EPOCH)
            cookieKeys.push(name);
    });
    names.forEach(function (name) {
        ownsReset();
        backing!.removeItem(name);
        if (backing!.getItem(name) !== null)
            throw new Error("Settings recovery failed");
    });
    // Delete only recorded player keys at the root path used by our adapter.
    // Foreign path/domain cookies are not ours to remove. A durable epoch and
    // empty allowlist keep unrecorded legacy cookies out of future fallbacks.
    cookieKeys.forEach(function (name) {
        ownsReset();
        document.cookie =
            encodeURIComponent(name) +
            "=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/";
    });
    ownsReset();
    cookies = readStorageCookies(true);
    if (
        cookieKeys.some(function (name) {
            return Object.prototype.hasOwnProperty.call(cookies, name);
        })
    )
        throw new Error("Settings recovery failed");
    document.cookie = STORAGE_RESET_EPOCH + "=1" + STORAGE_COOKIE_ATTRIBUTES;
    document.cookie =
        STORAGE_FALLBACK_KEYS + "=%5B%5D" + STORAGE_COOKIE_ATTRIBUTES;
    cookies = readStorageCookies(true);
    if (
        backing.length !== 1 ||
        cookies[STORAGE_RESET_EPOCH] !== "1" ||
        cookies[STORAGE_FALLBACK_KEYS] !== "[]"
    )
        throw new Error("Settings recovery failed");
    ownsReset();
    backing.removeItem(key);
    if (backing.getItem(key) !== null)
        throw new Error("Settings recovery failed");
    // Keep this page quarantined: modules may already have captured defaults.
    // The screen reloads only after this entire operation succeeds.
}

/** Undo a prepared batch before settings/provider hydration. Never overwrite a foreign edit. */
export function recoverSettingsJournal(backing: Storage): void {
    var key = "ottplaySettingsJournalV1";
    var raw = backing.getItem(key);
    if (raw === null) return;
    if (raw.length > 2 * 1024 * 1024)
        throw new Error("Invalid settings journal");
    var record = JSON.parse(raw);
    var seen: Record<string, boolean> = Object.create(null);
    if (
        !record ||
        record.version !== 1 ||
        !Array.isArray(record.writes) ||
        record.writes.length > 16000 ||
        Object.keys(record).sort().join(",") !== "version,writes"
    )
        throw new Error("Invalid settings journal");
    record.writes.forEach(function (entry: JournalWrite) {
        if (
            !entry ||
            Object.keys(entry).sort().join(",") !== "after,before,key" ||
            typeof entry.key !== "string" ||
            !entry.key ||
            isStorageMetadataKey(entry.key) ||
            seen[entry.key] ||
            (entry.before !== null && typeof entry.before !== "string") ||
            (entry.after !== null && typeof entry.after !== "string")
        )
            throw new Error("Invalid settings journal");
        seen[entry.key] = true;
    });
    for (var i = record.writes.length - 1; i >= 0; i--) {
        var entry = record.writes[i];
        if (backing.getItem(key) !== raw)
            throw new Error("Settings journal changed");
        if (backing.getItem(entry.key) !== entry.after) continue;
        if (entry.before === null) backing.removeItem(entry.key);
        else backing.setItem(entry.key, entry.before);
        if (backing.getItem(entry.key) !== entry.before)
            throw new Error("Settings recovery failed");
    }
    if (backing.getItem(key) !== raw)
        throw new Error("Settings journal changed");
    backing.removeItem(key);
    if (backing.getItem(key) !== null)
        throw new Error("Settings recovery failed");
}

/** Single-writer undo journal. Committed state is published by removing the journal. */
export function writeSettingsJournal(
    backing: Storage,
    writes: JournalWrite[],
    current: () => boolean
): void {
    var key = "ottplaySettingsJournalV1";
    if (backing.getItem(key) !== null)
        throw new Error("Settings recovery required");
    var seen: Record<string, boolean> = Object.create(null);
    writes.forEach(function (entry) {
        if (
            !entry.key ||
            isStorageMetadataKey(entry.key) ||
            seen[entry.key] ||
            (Object.prototype.hasOwnProperty.call(entry, "rollback") &&
                entry.rollback !== null &&
                typeof entry.rollback !== "string")
        )
            throw new Error("Invalid settings batch");
        seen[entry.key] = true;
        if (!current() || backing.getItem(entry.key) !== entry.before)
            throw new Error("Settings changed");
    });
    // Only recovery bytes are persisted. The raw preimage remains in memory for
    // optimistic comparisons; legacy credentials must not enter the journal.
    var recovery = writes.map(function (entry) {
        return {
            after: entry.after,
            before: Object.prototype.hasOwnProperty.call(entry, "rollback")
                ? entry.rollback
                : entry.before,
            key: entry.key,
        };
    });
    var raw = JSON.stringify({ version: 1, writes: recovery });
    if (writes.length > 16000 || raw.length > 2 * 1024 * 1024)
        throw new Error("Settings batch too large");
    backing.setItem(key, raw);
    if (backing.getItem(key) !== raw)
        throw new Error("Settings journal rejected");
    try {
        writes.forEach(function (entry) {
            if (
                !current() ||
                backing.getItem(key) !== raw ||
                backing.getItem(entry.key) !== entry.before
            )
                throw new Error("Settings changed");
            if (entry.after === null) backing.removeItem(entry.key);
            else backing.setItem(entry.key, entry.after);
            if (backing.getItem(entry.key) !== entry.after)
                throw new Error("Settings write rejected");
        });
        if (!current() || backing.getItem(key) !== raw)
            throw new Error("Settings changed");
        backing.removeItem(key);
        if (backing.getItem(key) !== null)
            throw new Error("Settings journal rejected");
    } catch (error) {
        // If recovery is interrupted again, the retained journal is retried at boot.
        if (backing.getItem(key) === raw) recoverSettingsJournal(backing);
        throw error;
    }
}

function readStorageCookies(includeUnowned = false): Record<string, string> {
    const result: Record<string, string> = Object.create(null);
    try {
        const entries = (document.cookie || "").split(";");
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i].trim();
            const equals = entry.indexOf("=");
            if (equals <= 0) continue;
            let key = "";
            try {
                key = decodeURIComponent(entry.slice(0, equals));
                result[key] = decodeURIComponent(entry.slice(equals + 1));
            } catch (_malformedCookie) {
                // A corrupt marker is incomplete, not an absent override list.
                if (isStorageMetadataKey(key)) result[key] = "";
                if (key === "parentPIN") result[key] = "!locked-invalid-pin";
            }
        }
    } catch (_cookieAccess) {
        result.parentPIN = "!locked-invalid-pin";
    }
    if (
        !includeUnowned &&
        Object.prototype.hasOwnProperty.call(result, STORAGE_RESET_EPOCH)
    ) {
        const allowed = readStorageFallback(result);
        Object.keys(result).forEach(function (key) {
            if (
                !/^__ottRemoteLifecycleToken_/.test(key) &&
                !isStorageMetadataKey(key) &&
                (!allowed || allowed.indexOf(key) < 0)
            )
                delete result[key];
        });
    }
    return result;
}

function storageFallbackHash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++)
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return (hash >>> 0).toString(36);
}

/** null means incomplete: never replace cookie values with stale native data. */
function readStorageFallback(cookies: Record<string, string>): string[] | null {
    const parts = Object.keys(cookies).filter(function (key) {
        return (
            key !== STORAGE_RESET_EPOCH &&
            key.indexOf(STORAGE_FALLBACK_KEYS + ".") === 0
        );
    });
    const marker = cookies[STORAGE_FALLBACK_KEYS];
    if (marker === undefined) return parts.length ? null : [];
    try {
        let saved = JSON.parse(marker);
        if (!Array.isArray(saved)) {
            if (
                !saved ||
                saved.v !== 2 ||
                !parts.length ||
                saved.n !== parts.length
            )
                return null;
            let value = "";
            for (let i = 0; i < parts.length; i++) {
                const part = cookies[STORAGE_FALLBACK_KEYS + "." + i];
                if (!part) return null;
                value += part;
            }
            if (storageFallbackHash(value) !== saved.h) return null;
            saved = JSON.parse(value);
        } else if (parts.length) return null;
        if (!Array.isArray(saved)) return null;
        for (let i = 0; i < saved.length; i++)
            if (typeof saved[i] !== "string" || isStorageMetadataKey(saved[i]))
                return null;
        return saved;
    } catch (_invalidMarker) {
        return null;
    }
}

function createLocalStorageAdapter(): StorageAdapter {
    let nativeStorage: Storage | null = null;
    let pinReadUncertain = false;
    try {
        nativeStorage = window.localStorage;
        if (nativeStorage) nativeStorage.getItem("");
    } catch (_error) {
        pinReadUncertain = true;
        nativeStorage = null;
    }
    // A failed or corrupt journal must not silently hydrate a half-imported account.
    if (nativeStorage) {
        try {
            recoverSettingsJournal(nativeStorage);
        } catch (_recoveryError) {
            recoveryStorage = nativeStorage;
            // Module evaluation must finish so the recovery UI can be reached.
            // Neither cookies nor native partial settings may escape quarantine.
            return createStorageAdapter(
                function () {
                    return null;
                },
                function () {},
                function () {},
                function () {},
                function () {
                    return {};
                }
            );
        }
    }
    let cookieWrites = true;
    const fallback = createCookieAdapter(function () {
        return cookieWrites;
    });
    const overrides: Record<string, boolean> = Object.create(null);
    const saved = readStorageFallback(readStorageCookies());
    let incomplete = saved === null;
    if (saved)
        saved.forEach(function (key) {
            overrides[key] = true;
        });
    const persistOverrides = function (update?: () => void): void {
        // Commit a small barrier before changing parts. A rejected part/final
        // manifest leaves this barrier visible to both boot and the next adapter.
        fallback.set(STORAGE_FALLBACK_KEYS, "pending");
        const persisted =
            readStorageCookies()[STORAGE_FALLBACK_KEYS] === "pending";
        // Rejected metadata cannot authorize a partly persisted value change.
        // CookieAdapter still keeps the current session's value in memory.
        cookieWrites = persisted;
        if (update) update();
        cookieWrites = true;
        if (!persisted) return;
        // Unknown tombstones cannot be reconstructed from cookie values alone.
        // Keep incomplete state until an explicit successful native clear.
        if (incomplete) return;
        const keys = Object.keys(overrides);
        const value = JSON.stringify(keys).replace(
            /[\u007f-\uffff]/g,
            function (ch) {
                return (
                    "\\u" + ("000" + ch.charCodeAt(0).toString(16)).slice(-4)
                );
            }
        );
        const parts: string[] = [];
        let offset = 0;
        if (keys.length)
            while (offset < value.length) {
                const name = STORAGE_FALLBACK_KEYS + "." + parts.length;
                // RFC 6265's 4096-byte minimum includes name, value and attributes.
                // ASCII-escaped JSON permits safe splits even inside a long key.
                const limit =
                    4096 -
                    encodeURIComponent(name).length -
                    1 -
                    STORAGE_COOKIE_ATTRIBUTES.length;
                let end = offset;
                let bytes = 0;
                while (end < value.length) {
                    const size = encodeURIComponent(value.charAt(end)).length;
                    if (bytes + size > limit) break;
                    bytes += size;
                    end++;
                }
                parts.push(value.slice(offset, end));
                offset = end;
            }
        parts.forEach(function (part, index) {
            fallback.set(STORAGE_FALLBACK_KEYS + "." + index, part);
        });
        const cookies = readStorageCookies();
        for (let i = 0; i < parts.length; i++)
            if (cookies[STORAGE_FALLBACK_KEYS + "." + i] !== parts[i]) return;
        Object.keys(cookies).forEach(function (key) {
            if (key === STORAGE_RESET_EPOCH) return;
            if (key.indexOf(STORAGE_FALLBACK_KEYS + ".") !== 0) return;
            const index = key.slice(STORAGE_FALLBACK_KEYS.length + 1);
            if (
                !/^(0|[1-9][0-9]*)$/.test(index) ||
                Number(index) >= parts.length
            )
                fallback.del(key);
        });
        if (parts.length)
            fallback.set(
                STORAGE_FALLBACK_KEYS,
                JSON.stringify({
                    h: storageFallbackHash(value),
                    n: parts.length,
                    v: 2,
                })
            );
        else if (cookies[STORAGE_RESET_EPOCH] !== undefined)
            fallback.set(STORAGE_FALLBACK_KEYS, "[]");
        else fallback.del(STORAGE_FALLBACK_KEYS);
    };
    const mark = function (
        key: string,
        active: boolean,
        update?: () => void
    ): void {
        if (active) overrides[key] = true;
        else delete overrides[key];
        persistOverrides(update);
    };

    // Keep readable settings when a privacy restriction or quota makes the
    // native adapter unusable. Cookie writes also have an in-memory fallback.
    const failover = function (): void {
        const previous = nativeStorage;
        nativeStorage = null;
        if (!previous || incomplete) {
            pinReadUncertain = true;
            return;
        }
        const scopedCookies =
            readStorageCookies()[STORAGE_RESET_EPOCH] !== undefined;
        try {
            for (let i = 0; i < previous.length; i++) {
                const key = previous.key(i);
                if (key != null && !isStorageMetadataKey(key)) {
                    const value = previous.getItem(key);
                    if (value != null && !overrides[key]) {
                        fallback.set(key, value);
                        if (scopedCookies) overrides[key] = true;
                    }
                }
            }
            if (scopedCookies) persistOverrides();
            // A complete readable snapshot establishes absence as well as values.
            pinReadUncertain = false;
        } catch (_error) {
            pinReadUncertain = true;
        }
    };
    const get = function (key: string): string | null {
        if (isStorageMetadataKey(key)) return null;
        if (overrides[key] || incomplete) {
            const value = fallback.get(key);
            return key === "parentPIN" && value === null && incomplete
                ? "!locked-invalid-pin"
                : value;
        }
        if (nativeStorage) {
            try {
                return nativeStorage.getItem(key);
            } catch (_error) {
                failover();
            }
        }
        const value = fallback.get(key);
        return key === "parentPIN" && value === null && pinReadUncertain
            ? "!locked-invalid-pin"
            : value;
    };
    const set = function (key: string, value: string): void {
        if (isStorageMetadataKey(key)) return;
        if (nativeStorage && !incomplete) {
            try {
                nativeStorage.setItem(key, value);
                if (overrides[key])
                    mark(key, false, function () {
                        fallback.del(key);
                    });
                else fallback.del(key);
                return;
            } catch (_error) {
                failover();
            }
        }
        mark(key, true, function () {
            fallback.set(key, value);
        });
    };
    const del = function (key: string): void {
        if (isStorageMetadataKey(key)) return;
        if (nativeStorage && !incomplete) {
            try {
                nativeStorage.removeItem(key);
                if (overrides[key])
                    mark(key, false, function () {
                        fallback.del(key);
                    });
                else fallback.del(key);
                return;
            } catch (_error) {
                failover();
            }
        }
        mark(key, true, function () {
            fallback.del(key);
        });
    };
    const clear = function (): void {
        if (nativeStorage) {
            try {
                nativeStorage.clear();
                Object.keys(fallback.dump()).forEach(function (key) {
                    fallback.del(key);
                });
                Object.keys(overrides).forEach(function (key) {
                    delete overrides[key];
                });
                incomplete = false;
                pinReadUncertain = false;
                persistOverrides();
                return;
            } catch (_error) {
                failover();
            }
        }
        const keys = Object.keys(fallback.dump());
        keys.forEach(function (key) {
            overrides[key] = true;
        });
        // Existing deleted overrides have no cookie, but remain tombstones.
        persistOverrides(function () {
            fallback.clear();
        });
    };
    const dump = function (): Record<string, string> {
        if (nativeStorage && !incomplete) {
            try {
                const result: Record<string, string> = {};
                for (let i = 0; i < nativeStorage.length; i++) {
                    const key = nativeStorage.key(i);
                    if (key != null && !isStorageMetadataKey(key)) {
                        const value = nativeStorage.getItem(key);
                        if (value != null) result[key] = value;
                    }
                }
                Object.keys(overrides).forEach(function (key) {
                    const value = fallback.get(key);
                    if (value == null) delete result[key];
                    else result[key] = value;
                });
                return result;
            } catch (_error) {
                failover();
            }
        }
        return fallback.dump();
    };
    var originalNative = nativeStorage;
    function physicalCurrent(): boolean {
        return (
            nativeStorage === originalNative &&
            !incomplete &&
            Object.keys(overrides).length === 0 &&
            !settingsRecoveryRequired()
        );
    }
    var favoritesPhysical = originalNative
        ? createFavoritesPhysicalStorageGrant(
              window,
              originalNative,
              physicalCurrent
          )
        : null;
    var favoritesRead = originalNative
        ? createFavoritesPhysicalStorageRead(
              window,
              originalNative,
              physicalCurrent
          )
        : null;
    var adapter = createStorageAdapter(get, set, del, clear, dump);
    adapter.captureFavoritesPhysicalStorage = function () {
        return favoritesPhysical && favoritesPhysical.current()
            ? favoritesPhysical
            : null;
    };
    adapter.captureFavoritesPhysicalRead = function () {
        return favoritesRead && favoritesRead.current() ? favoritesRead : null;
    };
    adapter.transaction = function (writes, current) {
        // Cookie/session fallbacks have no durable transaction contract.
        if (!nativeStorage || incomplete || Object.keys(overrides).length)
            return false;
        writeSettingsJournal(nativeStorage, writes, current);
        writes.forEach(function (entry) {
            fallback.del(entry.key);
        });
        return true;
    };
    return adapter;
}

// -- Cookie implementation ------------------------------------------------------

/**
 * Create a `StorageAdapter` backed by `document.cookie`.
 *
 * @returns A `StorageAdapter` object with all required methods.
 *
 * @remarks
 * Cookies use an expiration date in 2038 (far future) for `set` and
 * unix epoch (1970) for `del`. All values are URI-encoded/decoded.
 * The cookie path is always `/`.
 */
function createCookieAdapter(canPersist?: () => boolean): StorageAdapter {
    const values: Record<string, string | null> = Object.create(null);
    let cleared = false;
    const readCookies = function (): Record<string, string> {
        return cleared ? Object.create(null) : readStorageCookies();
    };
    const get = function (key: string): string | null {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            return values[key];
        }
        const cookies = readCookies();
        return Object.prototype.hasOwnProperty.call(cookies, key)
            ? cookies[key]
            : null;
    };
    const set = function (key: string, value: string): void {
        if (!key) return;
        values[key] = String(value);
        if (canPersist && !canPersist()) return;
        try {
            document.cookie =
                encodeURIComponent(key) +
                "=" +
                encodeURIComponent(value) +
                STORAGE_COOKIE_ATTRIBUTES;
        } catch (_cookieAccess) {}
    };
    const del = function (key: string): void {
        values[key] = null;
        if (canPersist && !canPersist()) return;
        try {
            document.cookie =
                encodeURIComponent(key) +
                "=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/";
        } catch (_cookieAccess) {}
    };
    const dump = function (): Record<string, string> {
        const result = readCookies();
        for (const key in values) {
            const value = values[key];
            if (value === null) delete result[key];
            else result[key] = value;
        }
        Object.keys(result).forEach(function (key) {
            if (isStorageMetadataKey(key)) delete result[key];
        });
        return result;
    };
    return createStorageAdapter(
        get,
        set,
        del,
        function clear(): void {
            const all = dump();
            for (const key in all) del(key);
            cleared = true;
        },
        dump
    );
}

// ---------------------------------------------------------------------------
// Main storage singleton  (ottpStorage IIFE)
// ---------------------------------------------------------------------------

/**
 * Main application storage adapter.
 *
 * Auto-detects `localStorage` support at module load time. Falls back to
 * cookie-based storage when `localStorage` is unavailable (e.g. STB
 * environments, sandboxed iframes, or privacy-restricted browsers).
 *
 * @remarks
 * The detection test mirrors `client_can.localstorage` from the original
 * player.js. A single `try/catch` wraps `window.localStorage` access.
 */
/** One-off Local playback never overwrites the next launch's selection. */
export function installLocalPlaybackSession(
    adapter: StorageAdapter
): StorageAdapter {
    var read = adapter.get,
        write = adapter.set,
        remove = adapter.del;
    var transaction = adapter.transaction;
    var session: {
        values: Record<string, string | null>;
        identity: () => string;
        captured: string;
        preview?: boolean;
    } | null = null;
    function playbackKey(key: string): boolean {
        return /^(?:ottplayprovs?|localMediaPlaybackSelection|localMediaPendingFile|offline(?:primaryIndex|catIndex|prevArr|continueWatch|lastcid|sSortAbc|playbackJournal(?:Source|:[^\r\n]{1,1024})?))$/.test(
            key
        );
    }
    function resumeKey(key: string): boolean {
        return /^offline(?:primaryIndex|catIndex|prevArr|continueWatch|lastcid|playbackJournal(?:Source|:[^\r\n]{1,1024})?)$/.test(
            key
        );
    }
    function libraryKey(key: string): boolean {
        return /^offlinechannelLibrary:[a-zA-Z0-9_.:@-]{1,1024}$/.test(key);
    }
    function previewKey(key: string): boolean {
        return (
            key !== "offlinesSortAbc" && (playbackKey(key) || libraryKey(key))
        );
    }
    function sessionKey(key: string): boolean {
        return session?.preview
            ? previewKey(key)
            : playbackKey(key) || libraryKey(key);
    }
    function libraryDocument(raw: string | null): any {
        var text = raw || "{}";
        if (text.substring(0, LZ_MARKER.length) === LZ_MARKER) {
            var decoded = decompress(text.substring(LZ_MARKER.length));
            if (!decoded) throw new Error("Invalid Local channel library");
            text = decoded;
        }
        var value = JSON.parse(text);
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error("Invalid Local channel library");
        return value;
    }
    function selectedOnly(
        metadata: string | null,
        cursor: string | null
    ): string {
        var value = libraryDocument(metadata),
            selected = libraryDocument(cursor);
        if (Object.prototype.hasOwnProperty.call(selected, "selected")) {
            if (!Object.prototype.hasOwnProperty.call(value, "selected")) {
                // A first temporary write removes the cursor from its physical
                // document. Restore its original field position for the
                // library's exact logical readback, without taking stale
                // metadata values from the cursor snapshot.
                var ordered: Record<string, any> = Object.create(null);
                Object.keys(selected).forEach(function (name) {
                    if (name === "selected") ordered[name] = selected.selected;
                    else if (Object.prototype.hasOwnProperty.call(value, name))
                        ordered[name] = value[name];
                });
                Object.keys(value).forEach(function (name) {
                    if (!Object.prototype.hasOwnProperty.call(ordered, name))
                        ordered[name] = value[name];
                });
                value = ordered;
            } else value.selected = selected.selected;
        } else delete value.selected;
        var text = JSON.stringify(value);
        // This overlay sits below provider compression. Preserve the metadata's
        // raw representation; transaction preimages remain the original bytes.
        return metadata?.substring(0, LZ_MARKER.length) === LZ_MARKER
            ? LZ_MARKER + compress(text)
            : text;
    }
    function current(): boolean {
        return !!session && session.identity() === session.captured;
    }
    function guarded(key: string): boolean {
        if (!session || !sessionKey(key)) return false;
        if (!current()) throw new Error("Local playback session changed");
        return true;
    }
    adapter.get = function (key) {
        var scoped = guarded(key);
        var shadowed =
            scoped &&
            Object.prototype.hasOwnProperty.call(session!.values, key);
        if (scoped && libraryKey(key)) {
            var stored = read(key);
            if (shadowed) return selectedOnly(stored, session!.values[key]);
            if (!session!.preview && stored) return selectedOnly(stored, null);
            return stored;
        }
        if (shadowed) return session!.values[key];
        // A new command has no inherited cursor or bookmark. Subsequent writes
        // belong to this owner and may resume normally within the same session.
        if (scoped && !session!.preview && resumeKey(key)) return null;
        return read(key);
    };
    adapter.set = function (key, value) {
        if (guarded(key)) {
            if (libraryKey(key))
                write(key, selectedOnly(String(value), read(key)));
            session!.values[key] = String(value);
        } else write(key, value);
    };
    adapter.del = function (key) {
        if (guarded(key)) {
            if (libraryKey(key))
                throw new Error(
                    "Choose a Local file before resetting its library"
                );
            session!.values[key] = null;
        } else remove(key);
    };
    adapter.transaction = function (writes, admitted) {
        if (
            session &&
            (session.preview ||
                writes.some(function (entry) {
                    return libraryKey(entry.key);
                }))
        ) {
            var owner = session;
            var physicalBefore: Record<string, string | null> =
                Object.create(null);
            if (
                !current() ||
                !admitted() ||
                writes.some(function (entry) {
                    if (!libraryKey(entry.key))
                        return adapter.get(entry.key) !== entry.before;
                    var prior = read(entry.key);
                    physicalBefore[entry.key] = prior;
                    var logical = Object.prototype.hasOwnProperty.call(
                        owner.values,
                        entry.key
                    )
                        ? selectedOnly(prior, owner.values[entry.key])
                        : !owner.preview && prior
                          ? selectedOnly(prior, null)
                          : prior;
                    return logical !== entry.before;
                })
            )
                return false;
            var physical = writes
                .filter(function (entry) {
                    return !sessionKey(entry.key) || libraryKey(entry.key);
                })
                .map(function (entry) {
                    if (!libraryKey(entry.key)) return entry;
                    if (entry.after === null)
                        throw new Error(
                            "Choose a Local file before resetting its library"
                        );
                    var prior = physicalBefore[entry.key];
                    return {
                        after: selectedOnly(entry.after, prior),
                        before: prior,
                        key: entry.key,
                        rollback: Object.prototype.hasOwnProperty.call(
                            entry,
                            "rollback"
                        )
                            ? selectedOnly(entry.rollback ?? null, prior)
                            : prior,
                    };
                });
            if (
                physical.length &&
                (!transaction ||
                    !transaction(physical, function () {
                        return session === owner && current() && admitted();
                    }))
            )
                return false;
            if (session !== owner || !current() || !admitted()) return false;
            writes.forEach(function (entry) {
                if (sessionKey(entry.key))
                    owner.values[entry.key] = entry.after;
            });
            return true;
        }
        var shadowed =
            session &&
            writes.some(function (entry) {
                return playbackKey(entry.key);
            });
        if (!shadowed) return !!transaction && transaction(writes, admitted);
        if (
            !current() ||
            !admitted() ||
            writes.some(function (entry) {
                return (
                    !playbackKey(entry.key) ||
                    adapter.get(entry.key) !== entry.before
                );
            })
        )
            return false;
        var values = { ...session!.values };
        writes.forEach(function (entry) {
            values[entry.key] = entry.after;
        });
        if (!current() || !admitted()) return false;
        session!.values = values;
        return true;
    };
    adapter.localPlayback = {
        active: function () {
            return !!session;
        },
        begin: function (identity) {
            var owner = {
                captured: identity(),
                identity: identity,
                values: { ottplayprov: "offline" },
            };
            session = owner;
            return function () {
                if (session === owner) session = null;
            };
        },
        capture: function () {
            var owner = session;
            return function () {
                return !!owner && session === owner;
            };
        },
        end: function (persist = false, extra) {
            if (!session) return false;
            if (!persist) {
                session = null;
                return true;
            }
            if (!current() || !transaction) return false;
            var owner = session;
            var values = { ...owner.values };
            if (extra) values[extra.key] = extra.value;
            var writes = Object.keys(values).map(function (key) {
                var prior = read(key);
                return {
                    after: libraryKey(key)
                        ? selectedOnly(prior, values[key])
                        : values[key],
                    before: prior,
                    key: key,
                };
            });
            if (
                !transaction(writes, function () {
                    return session === owner && current();
                })
            )
                return false;
            session = null;
            return true;
        },
        preview: function (identity) {
            if (session) return null;
            var rollback = adapter.localPlayback!.begin(identity);
            var owner = session!;
            owner.values = {};
            owner.preview = true;
            return {
                commit: function () {
                    return (
                        session === owner && adapter.localPlayback!.end(true)
                    );
                },
                current: function () {
                    return session === owner && current();
                },
                discard: rollback,
            };
        },
        profile: function (writes, admitted, playback = false) {
            if (!session || !current() || !transaction) return false;
            var owner = session;
            var saved = playback
                ? Object.keys(owner.values)
                      .filter(function (key) {
                          return (
                              key !== "ottplayprov" &&
                              !writes.some(function (entry) {
                                  return entry.key === key;
                              })
                          );
                      })
                      .map(function (key) {
                          var prior = read(key);
                          return {
                              after: libraryKey(key)
                                  ? selectedOnly(prior, owner.values[key])
                                  : owner.values[key],
                              before: prior,
                              key: key,
                          };
                      })
                : [];
            var batch = saved.concat(writes).concat([
                {
                    after: "offline",
                    before: read("ottplayprov"),
                    key: "ottplayprov",
                },
            ]);
            if (
                !transaction(batch, function () {
                    return session === owner && admitted();
                })
            )
                return false;
            session = null;
            return true;
        },
        transient: function () {
            return !!session && !session.preview;
        },
    };
    var reset = adapter.reset;
    adapter.reset = function () {
        session = null;
        reset();
    };
    // Keep the same adapter and aliases; reuse its standard typed shortcuts.
    var shortcuts = createStorageAdapter(
        adapter.get,
        adapter.set,
        adapter.del,
        adapter.clear,
        adapter.dump
    );
    adapter.getI = shortcuts.getI;
    adapter.has = shortcuts.has;
    adapter.hasValue = shortcuts.hasValue;
    adapter.setI = shortcuts.setI;
    return adapter;
}
export const storage: StorageAdapter = (() => {
    var adapter = installLocalPlaybackSession(createLocalStorageAdapter());
    var clear = adapter.clear;
    adapter.clear = function (): void {
        adapter.localPlayback!.end();
        var playback = (window as any).__ottClassicPlayback;
        if (playback) playback.suspendPersistence();
        var guide = (window as any).__ottClassicGuide;
        if (guide) guide.invalidate(false);
        clear();
    };
    return adapter;
})();

/**
 * Classic provider scripts (providers/<id>/provider.js) call bare
 * ottpStorage.del/has/hasValue. Concat const/let bindings stay script-local;
 * a global var plus window.ottpStorage must exist before loadChannels →
 * setPlayer (m3u overwrites global providerHasItemValue to use ottpStorage).
 */
/** Actual physical backend only; cookie/session fallback never qualifies. */
export function captureFavoritesPhysicalStorage(): FavoritesPhysicalStorageGrant | null {
    return storage.captureFavoritesPhysicalStorage
        ? storage.captureFavoritesPhysicalStorage()
        : null;
}
export function captureFavoritesPhysicalRead(): FavoritesPhysicalStorageRead | null {
    return storage.captureFavoritesPhysicalRead
        ? storage.captureFavoritesPhysicalRead()
        : null;
}

export var ottpStorage: StorageAdapter = storage;
if (typeof window !== "undefined") {
    (window as any).ottpStorage = storage;
}

// ---------------------------------------------------------------------------
// MAC address helpers  (laaMac)
// ---------------------------------------------------------------------------

/**
 * Generate a random MAC address.
 * Original: laaMac inner function t()
 */
function generateMac(): string {
    return "XY:XX:XX:XX:XX:XX".replace(/[XY]/g, (ch: string) => {
        if (ch === "Y") {
            return "26ae".charAt(Math.floor(Math.random() * 4));
        }
        return "0123456789abcdef".charAt(Math.floor(Math.random() * 16));
    });
}

/**
 * Get or generate a MAC address, persisted in storage.
 * Original: laaMac.get
 */
export function getMacAddress(): string {
    return (
        storage.get("laa_mac") ||
        (() => {
            const mac = generateMac();
            storage.set("laa_mac", mac);
            return mac;
        })()
    );
}

// ---------------------------------------------------------------------------
// Provider-prefixed storage
// ---------------------------------------------------------------------------

/** Provider prefix — set via setProviderPrefix() */
let prefix = "";

/**
 * Set the provider prefix for provider-scoped storage keys.
 *
 * @param g - The provider prefix string (appended before every provider key).
 *
 * @remarks
 * All subsequent `provider*` calls will use `prefix + key` as the
 * underlying storage key. This enables multi-provider configurations
 * (e.g. different middleware vendors) to share the same storage
 * namespace without key collisions.
 */
export function setProviderPrefix(g: string): void {
    prefix = g;
}

/** Compression threshold — values larger than this are compressed with lz-string */
const COMPRESS_THRESHOLD = 200; // bytes

/**
 * Get a provider-prefixed storage value, auto-decompressing if the value
 * starts with the LZ-compression marker.
 *
 * @param key - The logical key (without provider prefix).
 * @returns The stored string (decompressed if needed), or `null` if the
 *          key does not exist.
 *
 * @remarks
 * If the raw value starts with `LZ_MARKER` (`\x01LZ\x01`), the marker is
 * stripped and the remainder is decompressed via `decompress()`. If
 * decompression throws (corrupt data), the raw (still-marker-prefixed)
 * value is returned as-is as a fallback.
 */
export function providerGetItem(key: string): string | null {
    var raw = storage.get(prefix + key);
    if (raw && raw.substring(0, LZ_MARKER.length) === LZ_MARKER) {
        try {
            raw = decompress(raw.substring(LZ_MARKER.length)) || "";
        } catch (_) {
            /* return compressed form */
        }
    }
    return raw;
}

/**
 * Check whether a provider-prefixed key exists in storage.
 *
 * @param key - The logical key (without provider prefix).
 * @returns `true` if the key exists (value may be empty string).
 */
export function providerHasItem(key: string): boolean {
    return storage.has(prefix + key);
}

/**
 * Check whether a provider-prefixed key exists with a non-empty value.
 *
 * @param key - The logical key (without provider prefix).
 * @returns `true` if the key exists AND its value is not `''`.
 */
export function providerHasItemValue(key: string): boolean {
    const value = providerGetItem(key);
    return value !== null && value !== "";
}

/**
 * Set a provider-prefixed storage value, auto-compressing if the value
 * exceeds `COMPRESS_THRESHOLD` (200 bytes) and compression reduces size.
 *
 * @param key   - The logical key (without provider prefix).
 * @param value - The string value to store.
 *
 * @remarks
 * Compression is attempted only when `value.length > 200`. The compressed
 * output is stored with the `LZ_MARKER` prefix. If compression does not
 * yield a smaller string (or throws), the value is stored uncompressed.
 *
 * @sideEffects
 * Writes to the underlying storage adapter via `storage.set()`.
 */
export function providerSetItem(key: string, value: string): void {
    if (value.length > COMPRESS_THRESHOLD) {
        try {
            var compressed = compress(value);
            if (compressed.length < value.length) {
                storage.set(prefix + key, LZ_MARKER + compressed);
                return;
            }
        } catch (_) {
            /* fall through to uncompressed */
        }
    }
    storage.set(prefix + key, value);
}

/**
 * Delete a provider-prefixed key from storage.
 *
 * @param key - The logical key (without provider prefix) to delete.
 */
export function providerDelItem(key: string): void {
    storage.del(prefix + key);
}

/**
 * Read a provider-prefixed value and parse it as an integer.
 *
 * @param key          - The logical key.
 * @param defaultValue - Fallback value when the key is missing or the
 *                       stored value is not a valid integer.
 * @returns The parsed integer, or `defaultValue`.
 */
export function providerGetNum(key: string, defaultValue: number): number {
    const parsed = Number.parseInt(providerGetItem(key) || "", 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Read a provider-prefixed value and parse it as JSON.
 *
 * @param key          - The logical key.
 * @param defaultValue - Fallback value returned when the key is missing,
 *                       empty, or contains invalid JSON.
 * @returns The parsed value of type `T`, or `defaultValue` on failure.
 *
 * @remarks
 * If `JSON.parse` throws, the error is silently caught and `defaultValue`
 * is returned.
 */
export function providerGetJson<T>(key: string, defaultValue: T): T {
    const raw = providerGetItem(key);
    if (raw) {
        try {
            return JSON.parse(raw) as T;
        } catch (_e) {
            // fall through to default
        }
    }
    return defaultValue;
}

/**
 * Convenience wrapper around `providerGetItem` that returns an empty
 * string instead of `null` for missing keys.
 *
 * @param key - The logical key (without provider prefix).
 * @returns The stored value, or `''` if the key does not exist.
 */
export function loadValue(key: string): string {
    return providerGetItem(key) || "";
}

// ---------------------------------------------------------------------------
// Global storage aliases (backward compat with stbGetItem etc.)
// ---------------------------------------------------------------------------

/**
 * Backward-compatible alias — retrieve an item from the underlying storage.
 * @see StorageAdapter.get
 */
export const stbGetItem = storage.get;

/** Read the value a fresh page can recover, excluding session-memory fallbacks. */
export function stbGetPersistedItem(key: string): string | null {
    if (settingsRecoveryRequired() || isStorageMetadataKey(key)) return null;
    const cookies = readStorageCookies();
    const overrides = readStorageFallback(cookies);
    if (overrides !== null && overrides.indexOf(key) < 0) {
        try {
            const backing = window.localStorage;
            if (backing) return backing.getItem(key);
        } catch (_unavailable) {}
    }
    return Object.prototype.hasOwnProperty.call(cookies, key)
        ? cookies[key]
        : null;
}

/** Strict notification policy read: unavailable storage is not an absent opt-out. */
export function stbGetNotificationSetting(): string | null {
    if (settingsRecoveryRequired()) throw new Error("storage_unavailable");
    // A hidden/corrupt cookie override can supersede localStorage. Do not guess.
    document.cookie;
    var cookies = readStorageCookies();
    var overrides = readStorageFallback(cookies);
    var key = "sNotificationsEnabled";
    if (overrides === null) throw new Error("storage_unavailable");
    if (overrides.indexOf(key) >= 0) {
        // A marked override without a readable value is not a new installation.
        if (!Object.prototype.hasOwnProperty.call(cookies, key))
            throw new Error("storage_unavailable");
        return cookies[key];
    }
    try {
        var backing = window.localStorage;
        if (backing) return backing.getItem(key);
    } catch (_unavailable) {}
    if (Object.prototype.hasOwnProperty.call(cookies, key)) return cookies[key];
    throw new Error("storage_unavailable");
}

/**
 * Backward-compatible alias — store an item in the underlying storage.
 * @see StorageAdapter.set
 */
export const stbSetItem = storage.set;

/**
 * Backward-compatible alias — delete an item from the underlying storage.
 * @see StorageAdapter.del
 */
export const stbDelItem = storage.del;

/**
 * Backward-compatible alias — clear all items from the underlying storage.
 * @see StorageAdapter.clear
 */
export const stbClearAllItems = storage.clear;

/**
 * Backward-compatible alias — dump all items from the underlying storage.
 * @see StorageAdapter.dump
 */
export function stbGetAllItems(): Record<string, string> {
    var items = storage.dump();
    Object.keys(items).forEach(function (key) {
        if (
            key === "__ottKioskV1" ||
            key === "offlineProfileBindings" ||
            key === "__ottStandbyV1" ||
            key === "sNotificationsEnabled" ||
            key === "companionEndpoint" ||
            key === "sCompanionEndpoint" ||
            key === "torrentCatalogEndpoint" ||
            key === "sTorrentCatalogEndpoint" ||
            key === "torrentStreamAddons" ||
            key === "sTorrentStreamAddons" ||
            /^__ottRemoteLifecycleToken_/.test(key) ||
            isStorageMetadataKey(key)
        )
            delete items[key];
    });
    return items;
}

/** Credentials, consent and recursive snapshots belong to this installation. */
export function isPortableSettingsKey(key: string): boolean {
    return (
        key !== "__ottKioskV1" &&
        key !== "offlineProfileBindings" &&
        key !== "__ottStandbyV1" &&
        key !== "sNotificationsEnabled" &&
        key !== "companionEndpoint" &&
        key !== "sCompanionEndpoint" &&
        key !== "torrentCatalogEndpoint" &&
        key !== "sTorrentCatalogEndpoint" &&
        key !== "torrentStreamAddons" &&
        key !== "sTorrentStreamAddons" &&
        !/^__ottRemoteLifecycleToken_/.test(key) &&
        !isStorageMetadataKey(key) &&
        (window as any).OttPlayCore.classicPortableKey(key, true)
    );
}

/** Copy ordinary settings without changing provider payload strings. */
export function portableSettingsSnapshot(
    items: Record<string, any>
): Record<string, any> {
    var result = (window as any).OttPlayCore.classicPortableSnapshot(
        items,
        true
    );
    Object.keys(result).forEach(function (key) {
        if (
            key === "__ottKioskV1" ||
            key === "offlineProfileBindings" ||
            key === "__ottStandbyV1" ||
            key === "sNotificationsEnabled" ||
            key === "companionEndpoint" ||
            key === "sCompanionEndpoint" ||
            key === "torrentCatalogEndpoint" ||
            key === "sTorrentCatalogEndpoint" ||
            key === "torrentStreamAddons" ||
            key === "sTorrentStreamAddons" ||
            /^__ottRemoteLifecycleToken_/.test(key) ||
            isStorageMetadataKey(key)
        )
            delete result[key];
    });
    if (Object.prototype.hasOwnProperty.call(result, "offlineProfiles")) {
        var offline = (window as any).__ottOfflineProfiles;
        if (
            !offline ||
            typeof offline.validateStore !== "function" ||
            typeof result.offlineProfiles !== "string" ||
            !offline.validateStore(JSON.parse(result.offlineProfiles))
        )
            throw new Error("Invalid local video profiles");
    }
    if (Object.prototype.hasOwnProperty.call(result, "parentPIN"))
        result.parentPIN = (window as any).__ottPinSecurity.prepare(
            result.parentPIN
        );
    return result;
}

/** Restore ordinary local backup data without importing remote-control authority. */
export function restoreLocalSettingsSnapshot(items: Record<string, any>): void {
    if ((window as any).__ottKiosk && (window as any).__ottKiosk.enabled())
        return;
    var imported = portableSettingsSnapshot(items);
    var w = window as any;
    var current = w.stbGetAllItems();
    if (
        !Object.prototype.hasOwnProperty.call(imported, "parentPIN") &&
        Object.prototype.hasOwnProperty.call(current, "parentPIN")
    )
        imported.parentPIN = w.__ottPinSecurity.prepare(current.parentPIN);
    var retained = w.OttPlayCore.classicInstallationState(current, true);
    var address = retained.commandServerAddress;
    var token = retained.commandServerToken;
    var localEnabled = retained.sLocalHttpEnabled;
    var localCode = retained.sLocalHttpDeviceCode;
    imported.commandServerAddress = address;
    imported.commandServerToken = token;
    imported.commandServerEnabled = "0";
    imported.sLocalHttpEnabled = localEnabled;
    imported.sLocalHttpDeviceCode = localCode;
    var read = w.stbGetItem,
        write = w.stbSetItem,
        remove = w.stbDelItem;
    var keys = Object.keys(current);
    Object.keys(imported).forEach(function (key) {
        if (keys.indexOf(key) < 0) keys.push(key);
    });
    var writes = keys
        .filter(function (key) {
            // A backup cannot replace or erase this installation's grants.
            return (
                key !== "offlineProfileBindings" &&
                key !== "__ottStandbyV1" &&
                key !== "sNotificationsEnabled" &&
                key !== "companionEndpoint" &&
                key !== "sCompanionEndpoint" &&
                key !== "torrentCatalogEndpoint" &&
                key !== "sTorrentCatalogEndpoint" &&
                key !== "torrentStreamAddons" &&
                key !== "sTorrentStreamAddons" &&
                !isStorageMetadataKey(key)
            );
        })
        .map(function (key) {
            var before = read.call(w, key);
            return {
                after: Object.prototype.hasOwnProperty.call(imported, key)
                    ? imported[key]
                    : null,
                before: before,
                rollback:
                    key === "parentPIN" && before !== null
                        ? w.__ottPinSecurity.protectRollback(before)
                        : before,
                storage: {
                    key: key,
                    read: function () {
                        return read.call(w, key);
                    },
                    remove: function () {
                        remove.call(w, key);
                    },
                    transaction:
                        w.ottpStorage &&
                        read === w.ottpStorage.get &&
                        write === w.ottpStorage.set &&
                        remove === w.ottpStorage.del
                            ? w.ottpStorage.transaction
                            : undefined,
                    write: function (value: string) {
                        write.call(w, key, value);
                    },
                },
            };
        })
        .filter(function (entry) {
            return entry.before !== entry.after;
        });
    function admitted(): boolean {
        return (
            read === w.stbGetItem &&
            write === w.stbSetItem &&
            remove === w.stbDelItem
        );
    }
    w.commitSettingsWrites(writes, admitted, admitted);
    // Publish runtime effects only after storage committed. Retain installation authority.
    if (w.__ottCommandServer)
        w.__ottCommandServer.configure({
            address: address,
            enabled: false,
            token: token,
        });
    if (w.__ottClassicPlayback) w.__ottClassicPlayback.suspendPersistence();
    if (w.__ottClassicGuide) w.__ottClassicGuide.invalidate(false);
    // The existing native listener is independent. Preserve current local
    // consent and its code; imported values can neither enable nor replace it.
}
