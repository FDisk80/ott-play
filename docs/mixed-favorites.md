# Mixed Favorites

Global Favorites is one ordered collection for an installation, independent of
the currently selected provider. It can mix Local videos, M3U channels from
different profiles, VPortal videos and Plex videos. **Category → Favorites**
opens the collection. On PC and PC2, plain **F** adds or removes the focused or
currently playing item and shows a confirmation after persistence succeeds.
**Actions → Add channel to category → Favorites** adds to the same collection.
Temporary playback commands such as `ott t1 local shuffle ~/Videos/` do not
replace or filter the collection: opening Favorites still shows its entries
from every configured provider and profile.

Selecting **Category → Favorites** also remembers that view for this player.
It remains selected when switching providers or profiles, during temporary
Local playback and after restarting. Explicitly choosing another category ends
that preference; each source keeps its own ordinary category selection. Returning
to a source with an older saved Favorites view then opens All rather than
re-enabling Favorites. An installation without an explicit global choice keeps
its legacy per-source category behavior.

Opening or refreshing a list temporarily does not change the remembered choice.
An earlier asynchronous open cannot replace a newer category selection. Both the
player-wide preference and the source category must persist before a save is
accepted; a memory-only fallback does not count as a successful save. This
preference belongs to the receiving player and is not part of a transferred
Favorites collection.

In the mixed list, **Category** (Blue, or **V** on PC/PC2) and **Play/Pause**
open the current provider's category picker, even when Favorites is empty.
Configured category shortcuts retain their usual navigation. **Enter/OK** plays
the selected Favorite; **Back** closes the list without changing playback.

While a Global Favorites sequence is active in fullscreen, **Enter/OK** or
**Channels** reopens the mixed list. Number keys select its one-based mixed
order, rather than channel numbers in the currently loaded provider. Enter the
position and wait for the number-entry timeout; text editors, dialogs and access
restrictions retain priority.

The existing Add and Remove menu actions are idempotent: adding an existing
entry does not remove it, and removing an absent entry does not add it. F remains
a toggle. In the global list, the **Favorites: −** action removes only the selected
Favorites entry; it never deletes the channel or media file. Confirmation appears
only after a persisted change succeeds.

Each portable entry contains its display title, provider, profile, subprofile,
source alias and a typed content locator. The locator identifies a channel or
video; its current channel number is not used as a permanent identity. Local
entries use a root alias and relative file path. Plex entries identify the PMS
server and rating key. VPortal entries retain a provider item identifier and
folder context. M3U entries use an attested channel identifier, or a unique exact
channel name and group when no stable identifier is available.

## Moving a collection to another player

Configure the destination player's providers and profiles first. Importing
Favorites transfers references and order; it does not copy Local videos, grant
filesystem access, or provision provider credentials. Destination profile slots,
private identifiers and Local folder permissions can differ from the source.
Profiles are resolved through their configured identities or explicit mappings.

For example, an ordered list can switch from `Clips / opening.mp4` to a channel
in M3U profile `One`, then a VPortal movie, a Plex movie, and a channel in M3U
profile `Two`. On the receiving player, the equivalent profiles and the Local
root must be configured and accessible. A missing or ambiguous profile, root,
channel or movie is reported as unavailable. The player does not substitute the
same numbered channel or another similarly named file.

Merge retains existing entries and does not duplicate the same portable
identity. A conflicting title for an existing identity requires explicit
resolution; it is not silently overwritten. Replace uses the imported
collection as the new target collection after preview and validation. Review
the controller CLI's preview and result before treating a transfer as complete.

Older per-source Favorites are retained. Supported entries migrate when their
source context is available; unresolved legacy entries need an explicit mapping.
Opening the global list does not imply that every unopened provider has been
scanned or that all legacy references are already resolved.

## Host support and limits

The current global writer requires real persistent localStorage, a non-null
origin and Web Locks. These requirements protect concurrent changes and recovery
receipts. A host without those capabilities retains the per-source fallback and
does not advertise global write support. Serving the same frontend through
ottplay-server alone does not provide a different storage backend.

Global transfer documents contain at most 1,000 entries and 1 MiB. Their portable
identities do not contain provider credentials or expiring playback URLs.
Importing a document does not prove that every destination source is available;
playback resolution remains a separate check.

## OTT CLI examples

Export from one player, preview the merge on another, then apply it:

```sh
ott t1 fav global export favorites.json
ott t2 fav global import favorites.json merge --dry-run
ott -t 300 t2 fav global import favorites.json merge
```

There is no separate player-to-player copy command; this export/import sequence
is the explicit transfer. To adopt the exported order as the whole destination
collection, preview and apply `replace` instead of `merge`.

Store the collection in an existing named local CLI profile and load it elsewhere.
The `Home` preset must already exist; `collect` does not create a preset:

```sh
ott t1 fav global collect Home
ott t2 fav global diff Home
ott t2 fav global load Home replace --dry-run
ott -t 300 t2 fav global load Home replace
```

`ott t1 fav global list` lists the unified collection.
`ott t1 fav global current` reads the current item without saving it.
`ott t1 fav add "Evening cartoons"` saves the current item with that title.
Use `ott t1 fav play "Evening cartoons"` to dispatch playback, or
`ott t1 fav rm id:ACTUAL_UUID` to remove the receiver-local record.
A successful play response confirms dispatch, not visible video or audible audio.
The historical `fav current [NAME]` command is an add alias; it is not the
read-only `fav global current` operation.

Global commands require the corresponding player capability and controller
permission. Per-source UI fallback does not guarantee legacy CLI editing: an
updated host without Web Locks may advertise only legacy list/play, without
add/remove capabilities. Ordinary `fav` can announce a limited legacy mode on an older
player; a global-operation failure does not silently fall back to that mode.
When a local CLI profile includes a saved **global** Favorites companion, load settings explicitly
with `load Home --settings-only`, then load its collection with
`fav global load Home ...`; the normal profile load refuses silent omission.
An older per-source `preset_favorites` companion is a different format and cannot
be loaded with `fav global load`.

## After an interrupted write

Do not repeat an uncertain import, load, add or remove blindly. Use the operation
UUID printed by the CLI to check its outcome and inspect the separate recovery
ledger:

```sh
ott t2 fav global status OPERATION_UUID
ott t2 fav global recovery
ott t2 fav global recovery inspect OPERATION_UUID
ott t2 fav global acknowledge OPERATION_UUID --dry-run
```

Status uses the locally retained operation context. If that context is missing,
use the separately advertised recovery inspection. Only if you accept the
remaining uncertainty, confirm the exact fresh plan for this one player with
`ott t2 fav global acknowledge OPERATION_UUID --confirm PLAN_SHA256`.
Acknowledgement records that decision; it does not verify, undo or replay the
original write. A changed plan requires a new inspection. These commands do not
wake the player; availability still depends on its capabilities and your
controller permissions.
