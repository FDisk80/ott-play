# Playback startup, buffering and recovery

The interface starts without waiting for Hls.js and Shaka. Selecting a source
loads only its required engine. Native files and healthy native HLS do not need
these downloads. Concurrent requests share one load; a failed load can be retried.
A library load has a 15-second deadline, and callbacks from a stopped or replaced
source cannot restart playback.

The shared HLS/Shaka policy distinguishes live streams, on-demand video,
AceStream engine endpoints, Android and a reported memory budget of 2 GiB or less.
Saved **Buffer Size, s** preferences from 1 through 120 seconds override automatic
goals. Zero and values above 120 select the automatic profile; larger stored
values remain available for compatibility and are labelled Automatic in settings.
An absent memory hint does not mean that a device has low memory.

| Automatic profile | Forward target | Back buffer | HLS byte target |
| --- | --- | --- | --- |
| Desktop live | 30 s | 60 s | 120 MB |
| Android live, memory unknown | 30 s | 30 s | 64 MB |
| Reported memory ≤2 GiB, live | 20 s | 15 s | 32 MB |
| Desktop video on demand | 60 s | 60 s | 120 MB |
| Reported memory ≤2 GiB, video on demand | 30 s | 15 s | 32 MB |
| AceStream | 60 s, or 45 s at ≤2 GiB | Device default | Device default |

PiP retains no back buffer and halves the byte target. These are engine goals,
not hard limits on process memory. Native HTML5 playback remains controlled by
the browser or operating system. The legacy PC2 Video.js engine retains its
engine defaults because its buffer constants are shared globally.

Playback shows connecting, buffering, retrying and failure states in its existing
status area. Initial waiting is bounded at 30 seconds; a subsequent buffering
interval at 45 seconds. Repeated events and automatic retries do not extend an
active deadline. Expiry ends the spinner and shows an error; a late successful
playback can still recover. Transport retry limits remain owned by the existing
engine/source policy. Pause, stop and standby cancel feedback immediately.

Network `stalled` events do not by themselves mean that buffered video has
stopped playing. Confirmed playback position progress clears obsolete waiting
and timeout feedback, including recovery without another `playing` event.
Seeking and events from a replaced source are not evidence of recovery.
Feedback uses the existing compact resolution/status area, without an extra
footer row. Full error details remain available in its accessible label and
tooltip; feedback does not reopen or pin the information footer.

## Catalogue scope and verification

Classic FOSS builds index visible programme IDs when a guide snapshot changes.
Selecting a programme uses the index and returns an independent row copy.
Replacing the schedule also replaces the index; duplicate IDs retain the prior
first-match behaviour.

The independent FOSS2 frontend has a separate catalogue/EPG optimization and
release path. Its source changes are not implicitly deployed by a classic FOSS
release or by updating the shared core package.

Reproduce classic navigation measurements with:

```sh
node scripts/benchmark-guide-selection.cjs
```

This compares 1,000 selections of the last row in a 10,000-programme guide with
the prior filter-based lookup. It excludes building the index and is a synthetic
navigation benchmark, not a device startup measurement. Unit and browser tests
cover engine demand, failed loads, stale callbacks, profile selection, guide
replacement, status deadlines, pause and standby.

## Registered multiaudio normalization

For a registered normalization source, the standard shared player uses Hls.js
when MSE is supported. This avoids native WebKit stalls across producer
replacement while keeping the player's explicit audio-language choice. Main
video and CSS PiP use the same rule.

The rule parses the URL and matches only the complete gateway master routes
`/normalize/play/{source}/{key}/master.m3u8` and
`/normalize/lease/{lease}/{key}/master.m3u8`, with their bounded identifier formats.
Userinfo, query/hash suffixes, child playlists and paths containing those strings
elsewhere do not trigger it. This recognition is an engine hint, not gateway
authorization; the server still validates its own scoped credentials.

The selected engine preference is not rewritten, and unrelated channels, local
files and ordinary HLS URLs retain their existing behavior. If MSE is unavailable,
the existing native path remains; native fault recovery on older devices must be
verified independently. The separate Video.js PC2 engine is not changed by this
shared-core rule.
