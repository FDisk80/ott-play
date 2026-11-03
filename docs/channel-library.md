# Channel catalog and user state

`ChannelLibrary` owns a versioned, source-scoped document for user groups,
parental locks, selection and playback preferences. The provider catalog is a
separate input. `cats`, `catsArray` and numeric list positions are projections
created by `classic-library.ts` for the retained renderer and device ABI.

Commands use group and item IDs. Renaming a provider group preserves its live
membership; explicit membership edits preserve removals and include newly
discovered channels. A copied group is independent. Missing channels retain
their user data so it becomes available if they return.

The merged core catalog API supplies Xtream and Stalker item/category IDs.
`channel-catalog.ts` projects these references to numeric adapter IDs and
rejects collisions. Old title hashes only feed the migration observer;
ambiguous and cyclic migration mappings are not guessed. Protocols without
an upstream identity still require a URL or label fallback.

The source namespace separates provider accounts and M3U slots. Legacy
Favorites retain the core list model in a source-scoped envelope; supported
hosts expose the installation-wide collection described in
[Mixed Favorites](mixed-favorites.md). Channel history uses the source namespace
and stable group references. Existing
storage is imported once, with a claim preventing another account from
inheriting the same old records. Old keys remain available for recovery.
Unknown document versions and failed reads prevent writes. Failed writes do
not publish a new in-memory channel document.

The last browsed category is saved separately from the playing channel. Opening
Channels or Category selection restores that category, including Favorites,
after quitting with Q or restarting. Merely browsing a category does not change
the playing channel or the normal fullscreen startup. Ordinary category
preferences are scoped to the provider account and profile, using a stable
category ID rather than a translated label or position. An explicit Favorites
selection takes precedence across providers, profiles and temporary Local
playback until another category is explicitly chosen. This player-wide choice
is stored separately from the portable Favorites collection. A previously saved
per-source Favorites view alone does not enable that player-wide preference;
a later explicit non-Favorites choice suppresses those stale Favorites views.
If a category is temporarily missing during
catalog loading, All is shown without discarding the saved preference; choosing
another category replaces it. Library backups include this optional preference
and remain compatible with older documents that do not contain it.

Production JavaScript retains ES5. The unused `devices/legacy-core.js` artifact is excluded
from browser and native staging but retained as a test fixture.
The packaging audit rejects its reappearance in the shipped roots.
