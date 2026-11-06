# Interface colors

Open **Settings → Interface → Interface colors** to customize the player. The
editor offers a palette, exact HEX/RGB/HSV input, a preview, and five color
schemes: Midnight, Ocean, Warm graphite, High contrast, and Light.

## Choose and save colors

1. Select the part of the interface to change, such as Text color or Background
   color of selected item.
2. Choose a palette swatch or open HEX, RGB, or HSV to enter an exact color.
   HEX uses `#RRGGBB`; RGB components range from 0 to 255. HSV uses hue from
   0 to 360 and saturation and brightness from 0 to 100.
3. Inspect the sample list in the preview. Changes remain inside this editor
   until you choose **Apply**.
4. Choose **Apply** to update the current settings draft, then **Save Settings**
   in the parent settings screen to keep the changes after a restart.

**Cancel** discards changes made in the color editor. Cancelling the parent
settings screen also discards its unsaved draft. Closing the player is not a
substitute for Save Settings.

Use **Use inherited color** to remove the override for the selected part.
**Reset to default** removes all color overrides from the editor's draft. Apply
and save the reset to use the current theme's colors again. Changing a scheme
does not erase the older Classic color settings: those values remain the
fallback when overrides are removed.

The editor supports mouse and touch selection. With a keyboard or remote, use
the arrows to move between controls, Enter/OK to select, and Back/Escape to
cancel. Exact-value entry uses the player's existing text editor.

## What each color changes

- **Background color:** the background behind the interface.
- **Surface color:** panels and list surfaces.
- **Text color:** primary interface text.
- **Secondary text color:** descriptions and secondary labels.
- **Accent color:** highlighted titles and progress indicators.
- **Background color of selected item:** the selected list row.
- **Selected text color:** text inside the selected row.
- **Border color:** panel borders and separators.
- **EPG time color:** programme time labels.

Color settings belong to the client and apply across providers. They do not
change the video image, the separate subtitle appearance settings, or the
**Interface transparency** setting. Custom colors override the selected theme;
parts without overrides continue to inherit that theme.

## Backups and older versions

Updated clients include the setting in settings backups. Importing a typed
settings backup without the new field keeps the client's existing color
configuration. A full raw settings restore replaces the stored snapshot; if
that snapshot has no color key, the player returns to inherited colors.

Older clients cannot be assumed to display custom colors. An older typed
settings importer may ignore the new field and omit it from a later export.
Keep a backup produced by an updated client when transferring custom colors.

## Configuration format

The application setting is `uiColorConfig`; its stored key is `sUiColorConfig`.
An empty string means no overrides. Otherwise it contains canonical JSON with
version `1` and a partial map of supported color roles, for example:

```json
{"version":1,"colors":{"accent":"#67E8F9"}}
```

Allowed roles, in canonical order, are `background`, `surface`, `text`, `muted`,
`accent`, `selection`, `selectionText`, `border`, and `epgTime`. Values must be
uppercase six-digit HEX colors. The setting is limited to 2048 UTF-8 bytes.
Unknown fields, unsupported versions and arbitrary CSS are not accepted.
Remote writes require the canonical representation; the editor generates it.

Browser/PWA, OTTserver and the web clients packaged in Tauri, Capacitor, webOS
and Tizen share this implementation when updated. The native LG application
has its own renderer and requires a separate native update; updating the web
site alone cannot change its appearance.
