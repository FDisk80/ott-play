# Typed remote player settings

A compatible control server and CLI can discover, read and conditionally save the player's registered preferences. The player publishes `player_settings` version 1. Existing remote-control authorization enables this API; normal kiosk, PIN and platform restrictions still apply.

```sh
ott t1 settings
ott t1 settings list
ott -j t1 settings schema
ott t1 setting bufSize
ott t1 setting bufSize 3
ott t1 setting players hls.js
ott t1 setting players auto
```

Use the canonical IDs and choices returned by the target player. Integer toggles accept `0` or `1`, not JSON booleans. `players` is a provider/profile preference, so a usable provider storage context must exist; application preferences such as `bufSize` remain available when a catalogue fails to load.

The CLI obtains the descriptor and current revision before writing. The player validates the type/range, runtime, source, captured saved bytes and per-setting revision. A receipt expires after 120 seconds. It saves through the same settings draft used by local editors, verifies persistent storage, and then applies the setting's effects. A stale local editor cannot overwrite a remotely changed field without refreshing.

## Saved values and application

A read distinguishes the runtime preference, valid stored value, missing/default storage and invalid storage. Invalid raw bytes are never returned. A write reports `persisted: true` only after readback. Application is separate: completed, deferred until the next stream or manual action, or failed after saving. If application fails, inspect the saved value before repeating the write.

`bufSize` accepts 0–3600 seconds because that is the existing registry range. The engine treats 1–120 as an explicit buffer and treats 0 or anything above 120 as automatic buffering. The setting applies to the next stream; saving it does not restart current playback.

`players` accepts the stable choices `html5`/`native`, `hls.js`/`hls`, `shaka`/`shaka-player`, and `auto`/`automatic`. LG webOS uses automatic playback regardless of its saved preference; the readback reports that effective value. A saved engine preference does not prove that current playback changed engines.

Audio and subtitle language defaults also apply to the next stream; an explicit per-channel track selection takes precedence. Interface preferences with an unavailable platform apply hook are marked for manual application. Subtitle appearance saves wait for the existing renderer module, so a failed load cannot earn a successful save.

Two playback preferences are available in **Settings → Interface settings** in
Classic and Modern, and through the same remote settings API:

- **Resume archive after restart** (`resumeArchiveAfterRestart`, default `0`):
  start live TV after restarting. Set it to `1` to resume a valid saved archive
  position automatically. There is no archive confirmation popup. The existing
  bookmark expiry, channel availability and parental PIN checks still apply.
  Local-file and movie resume behavior is unchanged.
- **Seek notifications** (`showSeekNotifications`, default `1`): show the compact
  seek banner. Set it to `0` to hide these notifications without disabling
  seeking, the timeline, or other playback and error messages.

Both preferences belong to this client, persist across restarts, and use the
normal settings save/cancel and profile export/import paths. For example:

```sh
ott t1 setting resumeArchiveAfterRestart 1
ott t1 setting showSeekNotifications 0
```

Secret descriptors omit defaults, and secret reads omit current/stored/effective values. They only indicate whether a value is configured. For supported private values, the CLI accepts a UTF-8 file rather than putting the value on the command line:

```sh
ott t1 setting KEY --value-file /absolute/private/value.txt
```

Interface language, connection groups and device identity use acknowledged lifecycle adapters. Active address/credential changes use an atomic group patch, with guarded rollback on connection failure. See [remote language and connection settings](remote-settings-lifecycle.md) for commands, private JSON examples and transition troubleshooting.

For fields exposed by each provider and the Plex folder collection, see [provider settings](remote-provider-settings.md).

## VPortal configuration

VPortal configuration uses a separate `vportal_settings` capability and its existing driver codec. A provider-config file can target one of its 15 slots even while another provider is active:

```json
{
  "provider": "vportal",
  "settings": {
    "profile": 1,
    "name": "Family",
    "vportal": "portal::[key:YOUR_KEY]https://portal.example/api/v1/"
  }
}
```

```sh
ott t1 provider-config /absolute/private/vportal.json
```

Omit `name` to retain that VPortal slot's current name. The CLI compares the saved slot and obtains an opaque runtime/context/revision before writing. An inactive-slot save neither selects VPortal nor opens settings UI. A changed active slot reloads normally while awake; in standby it stays asleep and reports `reload_required: true`. Link changes discard cached sections through the driver's existing save path. Neither links nor tokens appear in acknowledgements or diagnostic operation evidence.

## Troubleshooting

- **Unsupported setting or capability:** update the player, control server and all CLI Python modules together. Refresh the player's capability list. The API lists registered preferences and active-provider fields; Plex folders use their collection adapter.
- **Revision conflict:** another local or remote change occurred, or the two-minute receipt expired. Read the setting again and decide whether the intended write is still appropriate.
- **Source/runtime changed:** a provider/profile switch or page reload invalidated the read. Obtain a new read from the current instance.
- **Policy restricted:** use the player's normal kiosk/PIN workflow. Remote authorization does not bypass its local policy.
- **Storage failed:** the value was not confirmed. Read it before retrying; inspect device storage availability. Effects are not applied before verified persistence.
- **Saved, effect failed:** persistence succeeded but application did not. Diagnose the renderer/native effect and avoid repeatedly rewriting the same value.
- **Optional module unavailable:** verify that `dist/remote-settings.js`, `dist/remote-settings-lifecycle.js` and `dist/remote-settings-extras.js` belong to the same deployed build. Native packages and offline asset inventories must include it. VPortal configuration also requires the matching `provider-vportal.js` asset; loading the configuration codec does not start its media requests.

For the controller wire contract, operator permissions and preset migration, see the [control server typed settings guide](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/player-settings.md). The [development coverage inventory](development/remote-settings-coverage.md) identifies the registry, provider-specific, lifecycle and interface/debug adapters, dedicated operations and concrete platform limitations.

See [interface and diagnostic preferences](remote-settings-extras.md) for visibility, local media, persistent debug and channel ordering settings, including native permission and platform limits.

Plex scans all libraries by default, including profiles with selections saved by the old folder picker. Those legacy values remain in the profile but are not active filters. Changing the folder collection through remote control explicitly enables that selection; clearing it restores all libraries. Changing the server clears its previous selection.
