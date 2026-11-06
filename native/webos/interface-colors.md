# Native interface colors

This guide describes the source candidate added by
`0025-native-interface-colors.patch`. It does not establish that an existing IPK
or installed television contains the change. Native OTTPlay is a separate SDL /
OpenGL ES application: updating the hosted player does not update this interface.

Open **Browse → Settings → Interface colors** in either Classic or Modern.
Choose a role, then a palette color or **Enter HEX color**. The editor accepts
six hexadecimal digits, with or without `#`; lowercase is normalized. Leave the
HEX field empty, or choose **Player default**, to inherit that individual role.
Choose **Reset colors** to inherit every role.

The five whole-interface schemes are **Midnight**, **Ocean**, **Warm graphite**,
**High contrast**, and **Light**. Their values and the 32 palette colors match
the shared web editor. A role can be adjusted after choosing a scheme.

Swatches, schemes, and the HEX editor's Save only update the group draft.
**Save Settings** commits the complete palette through the existing durable
settings writer. **Cancel** discards the draft; Back from a color list returns
to the group. A failed durable save does not publish a new palette. A stale
editor, replaced source, changed setting revision, or retired screen cannot
save into the current group. Successful changes are applied to the next frame;
no playback restart or profile switch is required.

The semantic roles are:

- `background`: application and page ground, including the custom hero ground.
- `surface`: panels and controls over the ground.
- `text`: primary labels and descriptions.
- `muted`: secondary labels and metadata.
- `accent`: highlighted progress and action details.
- `selection`: focused list or control background.
- `selectionText`: text on a selected background.
- `border`: interface boundaries and outlines.
- `epgTime`: programme times and the Classic clock/footer time labels.

The roles are resolved by the native renderer in both OTT and Plex views,
including Home, details, search, library, watchlist, menus, lists, and the player
HUD. Art and video pixels retain their own colors. The existing opacity setting
continues to control opacity separately. Inheriting every role preserves the
previous appearance, including artwork-derived backgrounds. A custom
background replaces the decorative ground instead of tinting media artwork.

## Remote setting contract

The setting is application-scoped, rather than provider- or profile-scoped.
Use the existing `player_settings` command with `op: "schema"`, `"get"`,
or `"set"` and the canonical setting ID `uiColorConfig`. Use this ID for CLI
and controller requests. `sUiColorConfig` is the web storage key and a native
compatibility alias; it does not create a second saved record. Existing
context/revision checks and write permission still apply. The value is a string, limited to 2048 UTF-8 bytes.
An empty string inherits every color.

A nonempty remote value must be compact canonical JSON. Its root order is
`version`, `colors`; version is `1`. Colors are partial, uppercase `#RRGGBB`
values, in this order when present: `background`, `surface`, `text`, `muted`,
`accent`, `selection`, `selectionText`, `border`, `epgTime`.

```json
{"version":1,"colors":{"background":"#080C12","text":"#F1F5F9","epgTime":"#67E8F9"}}
```

There are no arbitrary CSS values or alpha channels in this format. Extra keys,
unknown roles, and malformed colors are rejected. Empty `colors` uses the empty
string instead of a JSON object. Noncanonical remote writes are rejected, not
silently converted.

Reading existing saved values safely normalizes valid whitespace, key order,
and lowercase hex for display without rewriting the stored bytes. Malformed
stored values inherit the appearance; the color editor remains available for
an explicit repair. Opening or cancelling it preserves those original bytes.
This setting contract does not add a new native full-profile import API.

## Verification and delivery

The patch includes native regression tests for canonical parsing and tolerant
reads, renderer projection/reset, semantic text/clock colors, draft save/cancel,
HEX editor addressing, rejected stale callbacks, and corrupt-value repair.
Run these in the existing hosted native test/build pipeline, then verify the
resulting IPK on a television before treating runtime behavior as qualified.

For device acceptance, check both interface modes, a retained Plex screen,
Home/details/search, OTT lists and HUD, per-role reset, whole-scheme reset,
Save/Cancel, a failed save, and restoration after a real application restart.
These are acceptance steps, not claims that the tests have already run.
