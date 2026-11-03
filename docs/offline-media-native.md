# Native local media sources

New native **Add files** and **Add folder** selections retain references to the
original media. They do not copy the selected bytes into OTT storage. Existing
private imports remain compatible and are labeled as copies. Direct playback
requires the original file and its OS access permission to remain available.

Native exit saves the measured playback position before decoder teardown.
Startup restores that position only for the same selected local file and profile;
completed videos and manual selections start at zero. Tauri and Capacitor share
this player behavior with the browser and OTT Server. A pending startup seek
retains its saved position even if the app exits before metadata arrives.

## Shared contract

Android and iOS expose the `LocalMedia` Capacitor plugin. Tauri supplies the same
catalog shape through its private loopback endpoint and native picker commands.
The Capacitor methods `list()`, `importFiles()`, `importFolder()`,
`requestAccess({ id? })`, `remove({ id })`, and `removeSource({ id })` return a
snapshot. IDs are stable; playback URLs are regenerated after application launch.

```json
{
  "available": true,
  "persistent": true,
  "storage": "device",
  "sources": [{ "id": "source-id", "name": "Movies", "kind": "folder",
                "available": true, "access": "granted" }],
  "items": [{ "id": "item-id", "name": "Film.mp4", "size": 12345,
              "mime": "video/mp4", "url": "platform playback URL",
              "source": "linked", "sourceId": "source-id",
              "available": true, "access": "granted" }]
}
```

Unavailable items use an empty URL and remain identifiable rather than silently
becoming a copied file. Exact access-status strings depend on the platform.
`removeSource` disconnects a source and its library entries, never its original
files. `remove` on a linked entry removes/hides the reference; on a legacy
imported entry it deletes OTT's own copy. Source and item metadata are excluded
from media-content assumptions: a grant/bookmark is not an offline media backup.

## Android

The Storage Access Framework uses `ACTION_OPEN_DOCUMENT` for files and
`ACTION_OPEN_DOCUMENT_TREE` for folders with persisted read-only URI grants.
No all-files permission is requested. The API 22 Fire build uses this same
approach, but requires a functioning device document provider/picker.

The loopback listener binds to `127.0.0.1` and exposes opaque item IDs under a
random per-process token. It supports GET, HEAD, single byte ranges, suffix
ranges and CORS preflight, with four streaming connections and an 8 KiB request
header budget. It opens original `ContentResolver` descriptors, honors asset
start offsets and lengths, and requires seeking. A pipe/nonseekable provider is
rejected rather than copied. Paths and document URIs are not accepted in media
request URLs. **Refresh** rescans connected folders to discover new files.
See [Android ownership and tests](android-local-media-sources.md).

## iOS

The Files picker opens documents/directories with `asCopy: false`. OTT saves
minimal bookmarks. After resolving a bookmark it keeps security-scoped access
active while the playback URL can be used and releases that access on source
disconnection or plugin destruction. Stale bookmarks are refreshed. Linked
folders are scanned on refresh, with stable item IDs by relative path, a
20,000-entry bound, and no symbolic-link traversal outside the source.

Capacitor's existing file URL handler supplies WebKit playback from the original
URL; it does not make a separate OTT media copy. Cloud providers may still
materialize/cache files themselves. See [iOS limitations and acceptance](offline-media-ios-direct.md).

## Tauri desktop

The native dialog plugin chooses local paths. Updated Tauri builds also accept
an explicit absolute folder through authenticated remote control, for example
`ott t1 local connect /Volumes/data/Movies/`, when `absolute_paths` is advertised.
This path belongs to the target computer. The native command validates the
directory and reuses an existing canonical binding; it does not add an arbitrary
filesystem-path endpoint to the loopback HTTP API. See [Tauri source commands
and limits](tauri-local-media-sources.md#remote-local-videos-commands).

OTT stores source records and linked item paths, validates original files before serving them, and skips
symlinks during folder enumeration. **Refresh** rescans connected folders to
discover new media. A local loopback server
streams byte ranges from those originals using a fresh runtime token/port.
Disconnecting deletes metadata only. Existing private uploads remain readable.
OS privacy prompts, file moves and removed drives can invalidate access;
reconnect through the native picker when necessary. This desktop path capability
does not transfer to Android/iOS or grant browser filesystem access.

Folder items from the shared Tauri/server library include `relativePath`, such
as `Family/Season 1/Episode.mp4`, alongside the existing display `name`.
Favorites use this path and the source's saved name to distinguish identical
filenames in different subfolders. Neither the absolute mount path nor the
temporary playback URL is exported. A receiving player needs the equivalent
folder connected under the same source name. Older catalogs without
`relativePath` can still supply complete nested paths in `name`; a basename
alone does not reliably identify the original file. New catalogs return
`relativePath: null` for items without a portable folder path, rather than
allowing a basename to be mistaken for that path.
Version 1 Favorites and saved selections may contain only a basename for a
nested file. An imported `Clip.mp4` must not silently select a different
`Clip.mp4` in the connected folder's root, even if it is the only matching name.
These entries remain stored but require the original file to be selected again.
An existing local profile can retain its selection when its private binding
still identifies the exact file, source and library.

Explicitly adding a root-level file to Favorites stores a private confirmation
of that exact local file. This confirmation is not exported with Favorites or
settings. The unchanged version 1 format cannot distinguish an old truncated
name from a newly captured root-level path, so receiving players must also
reselect root-level files. Complete nested paths remain portable between
equivalent connected folders; separately granted file sources retain their
own source-bound profile selection.

## Native rollout and verification

Updated Tauri builds publish cumulative native snapshots during background
scanning. The frontend starts playback from an eligible partial catalog and
appends later entries without restarting the video. The standard spinner shows
one loading title and one count of playable videos found. Updated Android and
iOS bridges publish partial catalogs with request-scoped progress events. The
saved file is checked first; a confirmed missing file permits early playback of
the first available file within the active profile or folder kiosk. Pending
lookups and unavailable sources do not permit substitution. Cancel retires the
native scan and its progress listener. Older bridges remain one-shot compatible.
Stalled reads still reach the shared provider's inactivity timeout.

New native code requires an APK/IPA/Tauri application update. Updating only the
hosted page does not install a native picker or permission implementation. The
native UI assets must be bundled locally for a cold start without a network.
H.264/AAC in MP4 remains the portable direct-play starting point. Optional
[AVI/MKV compatibility](local-container-compatibility.md) uses an updated Tauri
or configured server backend with installed FFmpeg tools; mobile/browser direct
playback does not acquire a transcoder from a hosted-page update.

Android JVM tests cover full/partial reads, seeking, asset offsets, bounds and
truncation of original sources. iOS syntax and simulator build checks verify API
integration. Rust tests cover linked files and HTTP ranges. None substitutes for
signed hardware acceptance: select a large local file; verify OTT gained only
small metadata; play/seek; restart/reboot with networking disabled; disconnect
and verify originals remain; test missing/revoked sources and legacy copies.
Cloud-only files require a separate provider-cache test and cannot be assumed
offline just because the picker returned a reference.
