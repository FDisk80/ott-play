# One-off Local playback commands

Remote Local `play` and `shuffle` commands select a folder for the current player session. They do not replace the provider, Local profile, folder order, selected item, or resume bookmark that a fresh player runtime restores. This also applies to older clients that omit `session`; their existing response shape is unchanged.

Clients can probe `local_media_session: {version: 1}` and request `session: true` for an acknowledged one-off command. Only the literal `true` is accepted, only for `play` and `shuffle`. The acknowledgement echoes `session: true` only when requested. Progressive discovery remains an independent opt-in.

The player keeps this playback selection and its automatic bookmarks in a scoped RAM overlay after retiring the previous playback owner. Reloading or restarting creates a fresh storage adapter and restores the previous durable provider/profile immediately, without briefly loading the command's folder. A later command replaces the earlier session; stale cancellation cannot remove the newer owner.

Each explicit command starts its chosen file from the beginning. A saved profile's selected file or resume position cannot replace that choice, even if the command selects the same folder or happens to shuffle the same file again. For example, running `ott tt local shuffle ~/v/data/FFFF/` again creates a new temporary selection for each player; it does not continue the previous command's bookmark. Positions recorded after a command starts can still be used by a stream restart within that same session.

Normal startup of an active saved Local profile retains its resume behavior, including progressive discovery of the saved file. Temporary playback protects the saved library cursor while explicit edits to library metadata and preferences remain durable.

Explicit persistent actions remain persistent:

- Selecting another provider discards the one-off playback state and saves that provider.
- Selecting Local in the provider menu or by provider index, or explicitly activating Local playback, saves the current Local selection.
- Saving the current Local profile deliberately saves that selection and promotes its playback state. Loading a saved profile saves that profile/provider without promoting the discarded one-off bookmark.
- Enabling kiosk mode commits its policy and the selected playback state together. Failed durable transactions do not partially promote a session.

Settings exports and exports of an existing saved profile describe durable settings. Authentication, source grants, connected folders, library endpoints and unrelated preferences are outside the playback overlay. Connecting a source may therefore remain durable even when playing it is one-off.

The player does not guess which settings were written by older releases. Previously persisted providers or folder choices remain unchanged until an explicit selection changes them. An old player without the capability marker does not promise these session semantics.
