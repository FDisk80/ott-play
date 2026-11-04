# Tauri direct local sources

The desktop Local videos provider uses the operating system file/folder picker.
Selected videos remain in their original location: app data stores only small
JSON records, not copies of media. A folder selection scans media recursively;
non-media files and symlinks are skipped. Refresh scans the connected folders
again and discovers new files. Existing
IDs and unavailable file references are retained; exact source paths are
deduplicated.

The picker is `tauri-plugin-dialog` 2.7.3, exposed through the application's
`offline_media_import_files` and `offline_media_import_folder` commands. There is
no HTTP API for submitting an arbitrary filesystem path. These commands return
the private loopback endpoint, and the UI fetches its catalog. They do not upload
the picked files to that endpoint.

## Remote Local videos commands

An updated Tauri player also accepts an explicitly requested absolute folder
through authenticated remote control:

```sh
ott t1 local sources
ott t1 local connect /Volumes/data/Movies/
ott t1 local shuffle /Volumes/data/Movies/
ott t1 local shuffle Movies
```

An absolute path refers to the filesystem of the computer running `t1`, not the
working directory of the machine running the CLI. A name such as `Movies` refers
to a source already connected in that player. The native boundary resolves an
absolute path to its canonical directory, checks that it can be read, and saves
the source reference before starting background discovery. Selecting the same
canonical directory again reuses its existing source ID. A new remote connection
is rejected once 32 sources are registered; reconnecting an existing root remains
available. Originals are never copied, and the operating system can still deny
access to the directory.

Folder playback can start with the first playable portion of the selected
source, while discovery continues in the background. `local shuffle Movies`
shuffles the available portion and later discoveries extend the channel list;
an update does not restart the playing file. Starting before discovery finishes
cannot choose uniformly from files that have not yet been found. Each explicit
remote `local play` or `local shuffle` starts its chosen file at position zero,
including repeated commands for the same folder or file. An old saved-profile
cursor or bookmark does not override that choice. Normal startup of an active
saved Local profile may resume its saved file and position; a stream restart
within a temporary session may reuse that session's own bookmark. See
[one-off Local playback commands](local-media-session.md) for the boundary
between temporary playback and saved-profile restoration.

An accepted response is not proof of decoded video or a completed scan. Its
count describes the currently accepted portion when discovery is still active.
The library preserves the selected source and scan generation; it never mixes a
replacement scan into an active queue or claims a failed scan is complete.
The updated CLI explicitly negotiates progressive playback. Older callers keep
the complete-catalog response and must not receive a partial count as a total.

While discovery continues, Repeat All wraps through the currently known files;
a one-file prefix can therefore repeat until more files arrive. Repeat Off stops
at the last known file and a later catalog update does not restart playback.
A scan error or the 50,000-item queue limit stops further queue updates and
shows the standard channel-list failure notice; the current file is retained.
This is an incomplete queue, not a successful whole-folder scan.

If a command times out, inspect `local sources` and player status before sending
another change. An accepted connection and confirmed video playback are
separate outcomes. A missing mount, revoked directory access or an error in the
selected folder still needs attention even when other folders are healthy.

A newly connected directory cannot contain, or be contained by, another
connected source. The command reports this overlap without adding a partial
source; use the existing source or disconnect that source before connecting the
replacement directory. This avoids losing or duplicating files in the catalog,
which currently keeps one source binding per file. A filesystem root, relative
path, missing directory, or file supplied as a directory is rejected. Discovery
does not follow child symlinks outside the selected tree.

`local sources` returns names and source IDs without private paths. The explicit
`local sources --paths` form can include canonical native paths for a private CLI
profile backup. Windows exports use ordinary drive paths or forward-slash UNC
paths such as `//nas/videos/Movies`; canonical OS paths remain internal for file
access and source identity. These paths are not included in the ordinary HTTP
catalog or playback results. Keep such backups private. Copying a profile does
not copy media or create a matching filesystem on another player.

Preset verification can give `local_media_sources` an optional absolute `path`
filter. The native player resolves aliases on its own filesystem, validates the
directory, and returns its existing binding or an empty list. This read does not
connect a new source or scan media. It keeps remote preset checks accurate when
the same directory has a symlink alias or a different Windows path spelling.

The native commands `local_media_capabilities`, `local_media_sources`,
`local_media_link_folder` and `local_media_cancel_request` are restricted to the
main player window and its existing approved application origins. The frontend checks the authenticated
remote request and advertised capability before invoking them. These commands
do not extend the loopback HTTP API, change playback themselves, or add native
path access to browser, Android, iOS, or TV builds.
Remote folder registration carries a request ID and deadline. Cancellation
before registration prevents a queued request from connecting a folder later;
after registration has committed, the binding remains available. Cancelling a
remote request does not stop another folder's background scan.

Native directory scans have a separate 100,000-entry bound per source, counting
the selected root, subdirectories and non-media entries as well as videos. A
scan that exceeds it reports an incomplete-scan error; an already started
partial queue must not be reported as a complete catalog. The remote `local play` and
`local shuffle` queue limit is 50,000 playable items. Split a larger source into
smaller, non-overlapping folders. Disconnecting a source while its scan waits
cannot recreate that source or replace its stable ID.

The picker command schedules background discovery and returns without waiting
for the entire directory. The private catalog exposes cumulative items with
`scanning`, `scanned`, nullable `total`, and an optional `scanError`. While it is
scanning, the frontend polls every 250 ms and publishes changed snapshots. Adding
a folder starts playback when an eligible item becomes available; later entries
append without reopening the playing video. When restoring a saved selection,
the frontend passes its stable item ID to `offline_media_endpoint`. The native
library reads that one metadata record and validates its original file before
starting the full background scan. The first catalog can therefore contain the
saved video even when its record would be near the end of directory enumeration.
Playback resumes from the profile's saved position; later catalog batches do
not reopen it. Each Tauri instance uses its own metadata and profile selection.

Native catalogs also expose `sourceScans` with a source ID, generation and
`pending`, `scanning`, `complete` or `error` state for each tracked folder. These
states and the items belong to the same snapshot. Remote playback accepts the
first permitted playable portion of that folder's generation and continues
polling it; other library operations can still require complete discovery.
Older catalogs without this field retain their existing completion behavior.

An explicit native folder selection is scheduled independently of other
sources. For example, a five-video Movies folder can finish while a large FFFF
folder is still scanning. `local_media_sources` accepts an exact source ID or
name through its optional `selection` argument, so resolving Movies does not
probe unrelated mounted drives. The full catalog remains available throughout;
the selected queue contains only that folder and keeps one scan generation.
An unavailable or unmounted root remains visible with `available: false` and a
source scan error; other available sources can still play. If a readable root
cannot be traversed completely, its source error also sets the global
`scanError`, preventing library-wide operations from accepting a partial scan.

Source availability checks have a shared 15-second budget. A bulk listing can
keep healthy sources visible alongside `available: false` for a source whose
admitted filesystem check timed out. If waiting for capacity or reading source
metadata exceeds the budget, the whole lookup returns `operation_in_progress`.
An `available: false` row can also mean that access failed; it does not prove
that the folder disappeared.
For an exact path or a uniquely selected source, an unfinished check returns
`operation_in_progress`; it does not connect a replacement source or start
playback. An operating-system read already in progress can remain pending until
the filesystem returns, even after the command reports its deadline.

For a slow or newly mounted network drive, inspect the source before sending
another playback command. Replace `NAME` with your configured player alias:

```sh
ott -t 25 NAME local sources
ott -t 25 NAME local sources --path /Volumes/Media/Movies/
```

Check that the original volume is mounted and that macOS permits this specific
OttPlay instance to read network volumes. Successful access from a terminal does
not establish access for every app instance. The CLI does not retry playback
automatically, and a successful source check alone does not confirm video decoding.

Native app data also contains rebuildable, per-source metadata indexes. A
missing or malformed index is rebuilt from local metadata JSON without opening
other sources' original files. Legacy item IDs are retained during that rebuild;
new item IDs are stable if scanning is interrupted before the index is saved.
The original media and its individual metadata record are still validated
before playback or serving. Index files are internal caches, not an editable configuration.


Before the full metadata pass, a folder worker tries a bounded selection of
saved records and independently checks their original files. A valid record can
be published immediately with its existing ID. Missing, corrupt or unreadable
candidates only make this fast path miss; they do not prove the folder is empty
or authorize a replacement ID. The admission deadline is checked between file
operations; an already submitted operating-system read still has to drain.
Source discovery runs alongside the global metadata bootstrap.

Full folder discovery validates saved metadata and then walks the original
directory once. Known regular files reuse the no-follow file type captured during
enumeration, avoiding another per-file network metadata request. New files and
directories retain their metadata/access checks. Each directory must keep its
canonical identity; modification stamps are checked again after enumeration.
A changed or incompletely read directory cannot certify a complete queue.

Catalog availability is an enumeration-time observation, not a guarantee that
a later open or decode will succeed. Directory stamps are not an immutable
filesystem snapshot, especially with network attribute caches. Actual media
serving and preferred-item lookup still perform the full token, metadata,
source and original-path validation. Missing or unverified saved entries retain
their IDs and remain unavailable. A partial queue remains explicitly incomplete
until its source scan finishes.

In the [controlled concurrent-Range test](evidence/local-folder-range-performance-20261027.md),
the final code completed a fresh, unindexed 13,657-record library in 28.831
seconds while reading video. This is core-harness evidence, not a fixed latency
guarantee or installed-player playback verification. The report also preserves
the slower baseline and the separate warm-metadata measurement.

Scanning performance does not add codecs, containers or transcoding. A source
may connect successfully yet contain no playable entries. Check the player's
`supported_formats` when advertised, and diagnose unsupported files separately
from scan progress or a missing mount.

The preferred lookup accepts only an existing opaque item ID, never a path. It
is bounded so a missing or unresponsive source cannot block scan startup. An
unavailable source still follows the recovery flow. When the source is available
and the saved file is confirmed missing, the first playable file allowed by the
active profile or folder kiosk starts without waiting for the full scan. A lookup
still in progress cannot authorize that fallback. Reading an endpoint during an active scan does not
restart that scan.

Standby cancels pending lookup and scan work. After an explicit wake, an
invalidated catalog is rebuilt in the background with the same saved-item
priority; a completed valid catalog is reused. A late endpoint response from
before standby cannot start a new catalog request.
Acceptance must cover a playing instance entering standby during a partial scan
and waking in the same window. Confirm a new provider load, the same saved file
and position, and continued catalog growth; an accepted wake command alone does
not establish that playback resumed.

The standard loading dialog shows its loading title once and one count of
playable videos found. Internal scan counters remain available for diagnostics
and stall detection; they are not a second visible count or downloaded bytes.
Unchanged polling does not reset the 60-second stall timeout.
The loading window has Cancel for pointer/touch and Back/Esc. Q cancels the
pending request before exiting on PC. Late results cannot reopen the window or
start a video after cancellation; strict kiosk keeps its local-input lock.
Catalog polling does not start a second scan. Explicit Refresh requests a new
scan, and source changes preserve existing item IDs.

The existing Rust byte-range server opens the original files read-only. URLs use
opaque IDs and a random per-process token rather than filesystem paths. JSON
catalogs expose source names, availability, and item source IDs, not full paths.
The local server listens only on `127.0.0.1`.

`offline_media_remove_source` (and the authenticated DELETE source route) removes
the source's metadata and references. It never removes an original linked file.
Legacy private imports remain playable and can still be deleted as private
copies. Missing/moved originals remain listed unavailable instead of triggering
a copy. Reconnect the original drive/folder or choose a new source. macOS privacy
restrictions may require allowing folder access again; this is a desktop Tauri
implementation, not a sandbox security-scoped bookmark implementation.

The shared server distribution retains its explicit upload library. Server
uploads and native desktop source linking are different operations.

Automated Rust core tests cover persisted links, nested scans,
byte-range reads, unavailable originals, unchanged source files after disconnect,
legacy upload behavior, symlink exclusion, canonical path lookup, private path
exports and the source and scan-entry limits. Tauri command tests cover the
main-window boundary. OS-picker UI and actual video decoding need native app
verification.

Official picker API: https://v2.tauri.app/plugin/dialog/

The existing Local videos screen loads its packaged `dist/local-media-ui.js`
asset on demand. Source imports, removals, catalog scanning and playback
activation keep their existing main runtime APIs. File/folder pickers still
start synchronously from their user action. A late UI download cannot reopen a
replaced or cancelled screen, and a failed download can be retried.
