import { globalFavoriteCanonical } from "../media/global-favorites-identities";
import { createFavoritesRecoveryCodec } from "./favorites-recovery-codec";
import { isGlobalFavoriteSelector } from "./global-favorites-bindings";

const LOCAL_FAVORITE_PROOFS_KEY = "local-favorite-path-proofs.v1";

/** Installation-private evidence. Portable v1 basenames cannot prove a root file. */
export function createLocalFavoriteProofs(ports: any): any {
    var grant = ports.grant,
        uncertain = false;
    function current(): boolean {
        return !uncertain && ports.current() && grant.current();
    }
    function identity(row: any): string {
        return globalFavoriteCanonical({
            locator: row.locator,
            origin: row.origin,
        });
    }
    var proofFields = [
            "favorite",
            "favoriteId",
            "itemId",
            "relativePath",
            "selector",
            "sourceId",
        ],
        proofShape = proofFields.join(",");
    function rows(raw: string | null): any[] {
        if (raw === null) return [];
        if (raw.length > 8388608) throw new Error("invalid_local_proof");
        var value = JSON.parse(raw),
            ids: any = Object.create(null);
        if (
            !value ||
            value.version !== 1 ||
            Object.keys(value).sort().join(",") !== "entries,version" ||
            !Array.isArray(value.entries) ||
            value.entries.length > 1000 ||
            !value.entries.every(function (row: any) {
                if (
                    !row ||
                    Object.keys(row).sort().join(",") !== proofShape ||
                    !proofFields.every(function (key) {
                        return (
                            typeof row[key] === "string" &&
                            !!row[key] &&
                            row[key].length <= 65536
                        );
                    }) ||
                    ids[row.favoriteId]
                )
                    return false;
                ids[row.favoriteId] = true;
                return true;
            })
        )
            throw new Error("invalid_local_proof");
        return value.entries;
    }
    function matching(snapshot: any, selector: any, locator: any): any[] {
        if (
            !isGlobalFavoriteSelector(selector) ||
            selector.provider !== "offline" ||
            locator?.kind !== "local-media" ||
            selector.root.alias !== locator.rootAlias
        )
            return [];
        var key = identity({ locator: locator, origin: selector.origin });
        return snapshot.entries.filter(function (row: any) {
            return identity(row) === key;
        });
    }
    async function read(selector: any, locator: any): Promise<any> {
        try {
            if (!current()) return null;
            var snapshot = await ports.snapshot(),
                matches = matching(snapshot, selector, locator),
                raw = grant.read(LOCAL_FAVORITE_PROOFS_KEY),
                selectorKey = globalFavoriteCanonical(selector);
            if (matches.length !== 1) return null;
            var favorite = matches[0],
                found = rows(raw).filter(function (row: any) {
                    return (
                        row.favoriteId === favorite.id &&
                        row.favorite === globalFavoriteCanonical(favorite) &&
                        row.selector === selectorKey &&
                        row.sourceId === selector.root.id &&
                        row.relativePath === locator.relativePath
                    );
                });
            var storageCurrent = function (): boolean {
                return (
                    current() &&
                    globalFavoriteCanonical(selector) === selectorKey &&
                    grant.read(LOCAL_FAVORITE_PROOFS_KEY) === raw
                );
            };
            var valid = function (): boolean {
                return storageCurrent() && snapshot.current();
            };
            if (found.length !== 1 || !valid()) return null;
            return {
                current: valid,
                itemId: found[0].itemId,
                relativePath: found[0].relativePath,
                sourceId: found[0].sourceId,
                storageCurrent: storageCurrent,
                title: favorite.title,
            };
        } catch (_) {
            return null;
        }
    }
    function record(capture: any, revision: string, held?: any): Promise<void> {
        // Keep admission synchronous and every failure promise-rejected; the
        // returned promise adopts the lock completion without another await.
        return new Promise<void>(function (resolve) {
            var evidence = capture.localProof,
                selector = capture.selector,
                locator = capture.value.locator;
            if (
                !evidence ||
                !current() ||
                !capture.current() ||
                typeof evidence.itemId !== "string" ||
                !evidence.itemId ||
                evidence.sourceId !== selector.root?.id ||
                evidence.relativePath !== locator.relativePath
            )
                throw new Error("unavailable");
            var write = async function (held: any) {
                var snapshot = await ports.snapshot(),
                    matches = matching(snapshot, selector, locator),
                    ledger = grant.read("favorites-receipts.v1"),
                    receipt = await createFavoritesRecoveryCodec({
                        sha256: ports.sha256,
                    }).snapshot(ledger);
                function admitted(): boolean {
                    return (
                        held === grant &&
                        current() &&
                        capture.current() &&
                        ports.canWrite() &&
                        snapshot.current() &&
                        snapshot.revision === revision &&
                        grant.read("favorites-receipts.v1") === ledger
                    );
                }
                if (
                    !admitted() ||
                    matches.length !== 1 ||
                    receipt.records.some(function (row: any) {
                        return !row.acknowledgement;
                    })
                )
                    throw new Error("reconciliation_required");
                var favorite = matches[0],
                    before = grant.read(LOCAL_FAVORITE_PROOFS_KEY),
                    entries = rows(before).filter(function (row: any) {
                        return (
                            row.favoriteId !== favorite.id &&
                            snapshot.entries.some(function (saved: any) {
                                return (
                                    row.favoriteId === saved.id &&
                                    row.favorite ===
                                        globalFavoriteCanonical(saved)
                                );
                            })
                        );
                    });
                entries.push({
                    favorite: globalFavoriteCanonical(favorite),
                    favoriteId: favorite.id,
                    itemId: evidence.itemId,
                    relativePath: evidence.relativePath,
                    selector: globalFavoriteCanonical(selector),
                    sourceId: evidence.sourceId,
                });
                var after = JSON.stringify({
                    entries: entries,
                    version: 1,
                });
                rows(after);
                if (!admitted()) throw new Error("changed");
                if (before === after) return;
                var result;
                try {
                    result = grant.compareAndSwap(
                        LOCAL_FAVORITE_PROOFS_KEY,
                        before,
                        after,
                        admitted
                    );
                    if (
                        result === "confirmed" &&
                        admitted() &&
                        grant.read(LOCAL_FAVORITE_PROOFS_KEY) === after
                    )
                        return;
                } catch (_) {}
                if (result !== "conflict") {
                    // A rejected or ignored write with authoritative unchanged
                    // bytes is a known no-op; a fresh explicit add can retry.
                    uncertain = true;
                    try {
                        uncertain = !(
                            grant.current() &&
                            grant.read(LOCAL_FAVORITE_PROOFS_KEY) === before &&
                            grant.current()
                        );
                    } catch (_) {}
                }
                throw new Error("storage_unavailable");
            };
            resolve(held ? write(held) : grant.exclusive(write));
        });
    }
    return { read: read, record: record };
}
