# Studio 2026 and interface settings

**Interface settings → Interface mode** selects **Classic** (`0`) or
**Modern** (`1`). This application preference is independent of the colour
theme. Classic remains the default presentation; selecting Modern does not
change the saved theme, provider, categories, Favorites or playback position.
[Modern interface](modern-interface.md) describes the catalogue presentation,
navigation, remote setting and fallback behavior.

Studio 2026 is the default theme for an unset or invalid `sInterfaceTheme`.
Explicitly saved Classic (`0`), PLi-HD (`1`) and Studio (`2`) selections survive
restart. Selecting a theme does not reset any other preference.

**Interface colors** provides a palette, exact HEX/RGB/HSV input, and five
schemes for nine parts of the interface. Overrides work with both Classic and
Modern presentation. Unchanged parts inherit the chosen theme; older stored
Classic colors remain the fallback when custom overrides are cleared.

The editor previews changes locally. **Apply** updates the open settings draft;
**Save Settings** makes that draft persistent. Cancel either screen to discard
its unsaved changes. Per-color inheritance and a full reset are available. See
[Interface colors](interface-colors.md) for controls, backup behavior and the
remote configuration format.

The presentation was developed for OTT-play FOSS in September 2026. It uses
original HTML/CSS, existing player fonts and the established two-panel layout.
[Interface history](interface-history.md) preserves the separate PLi-HD credits,
upstream links and the earlier OTT-play lineage in English.

## Settings contract

- **Rows:** `pageSize` remains 25 by default, with the existing 10–30 range.
  At the default font scale, a full page renders the selected count. Enlarged
  fonts use fewer visible rows without changing this saved preference. The
  final page contains only the remaining channels at the same row height.
  Modern catalogues calculate a separate visible capacity for their cards or
  larger channel rows without overwriting this saved Classic preference.
- **Typography:** all seven saved font indices and the 0–30 line-spacing setting
  remain available. At 100%, text retains the configured row density. Above
  100%, each page displays fewer rows so enlarged text remains readable; the
  saved row count stays unchanged and keyboard navigation reaches every item.
  Native builds retain their corresponding OS font families.
  **Interface settings → Font size, %** controls the shared interface text scale.
  The default is **100%**; the allowed range is **20–200%**. The menu offers
  ten-percent steps and preserves an exact percentage set remotely. This is an
  application preference, so switching providers or restarting the player does
  not reset it. Saving applies the scale immediately. Subtitle appearance has
  its own font-size control.
- **Layout:** list side, reduced-video mode and scrollbar visibility remain
  independent of the theme. The preview and its opaque mask use one shared
  rectangle. Resizing recalculates both row and logo/progress geometry.
  Classic details also stay below the header when reduced video is disabled.
- **Row separators:** **Lists settings → Show list separators (Classic)**
  hides or restores the thin lines between rows in Category selection, Channel
  list, EPG and archive. The default is **yes**, preserving the current theme's
  appearance; themes without these lines remain unchanged. The setting does not
  change Modern mode, settings rows, dialogs, focus indicators, or outer borders.
  It is saved for the client, applies immediately after Save, and survives
  provider changes and restarts. Cancel keeps the previous value. Backups and
  remote settings use `showListSeparators` (`1` = yes, `0` = no); resetting this
  setting restores `1`.
- **Channel information:** number, logo (hidden/square/wide), channel name,
  programme name, progress, archive indication, description, thumbnail and
  upcoming programme count retain their existing controls and provider scope.
  Large upcoming lists scroll inside the available detail space without covering
  the current title. Selecting a channel without current EPG clears old details.
- **Clock and OSD:** all three permanent-clock modes apply on save; the opaque
  clock follows OSD opacity, the transparent clock has no background, and both
  hide while the list is open. Font or window changes preserve the selected
  opacity. The existing 0–10 opacity range is unchanged.
- **Other interface controls:** graphical yes/no/off indicators now read their
  saved setting. Info timing, slide/switch/change/rewind behaviour, PiP, timezone,
  editor choice, remote mappings and hidden-menu IDs keep their existing owners.
  The theme adds no playback, provider or remote-action mapping.
- **Desktop window controls:** in the Tauri main window, **Always on top** and
  **Lock window to 16:9** show their confirmed native state using the same
  graphical indicators as other switches, or localized text when graphical
  indicators are disabled. Changes apply immediately and leave Interface open.
  A new instance enables the 16:9 resizing constraint by default; an explicitly
  saved off value remains off. Enabling it preserves the current window size on
  macOS and Windows; an X11 window manager may immediately adjust the size to
  16:9. It does not change the video's aspect ratio. Unsupported backends display
  **Unavailable**.
  See [native window constraints](native-window-aspect-lock.md).
- **Sleep timer:** the disabled value is the localized word **Off**, including
  when graphical indicators are enabled.

Studio uses graphite `#0e1114`, primary text `#f0f3f1`, secondary text `#a3afa9`
and mint `#8bddb8`. The focused list row uses `#e7f1eb` with dark text `#112119`
and secondary text `#4a6255`. A separate edge mark identifies the current channel;
moving focus does not transfer that mark. Colour-key cues remain visible in the
footer. Studio has no new font download, blur requirement or focus animation.

## Touchscreen browsers

The browser player, including `/f/pc/`, supports vertical touch scrolling in
channel and settings lists. Drag upward to reach later entries and downward to
reach earlier entries; a quick flick continues briefly after release. Paging
does not interrupt the gesture, and dragging never activates a channel.

Browser taps keep the same selection and activation behavior as mouse clicks.
Native Capacitor players retain their existing tap behavior. Mouse-wheel and
remote navigation, gestures outside the list and text editing are unchanged.
There is no need to select an Android or Tizen device target to use touch input.

## Remote font size

On an updated player, read or change the same saved preference through remote
control:

```sh
ott f setting uiFontScale
ott f setting uiFontScale 20
ott f setting uiFontScale 100
```

Replace `f` with the player's alias. `20` selects 20%; `100` restores the default
size. Any whole percentage from 20 to 200 is accepted. The menu includes 20%,
30%, 40% and the existing ten-percent steps, and retains an exact value set
remotely. The setting scales interface text, not the whole page or video.

Older players advertise a minimum of 50%; update the player before requesting
20%. Read the setting again after reconnecting to confirm persistence. If it
returns 20 but the display still looks unchanged, check that the player loaded
the updated interface assets before retrying the change.

## Regression coverage

`tests/browser/channel-list-csp.spec.cjs` runs the actual built server and Tauri
renderers in Chromium and WebKit, including Tauri's enforced style CSP.
It covers all three themes, 10/25/30 rows, both sides and both video modes at
900×506, 1280×720, 1920×1080 and 3840×2160 (576 combinations across the two
renderers and two engines). It also tests a mounted-list resize to 640×360,
first-open font sizing, paging, keyboard/pointer focus, asynchronous EPG updates,
all seven font indices, extreme spacing, display toggles, upcoming counts
0/1/20, preview modes, clock modes, opacity 0/3/10 and graphical indicators.

Settings-store and settings-parity tests cover persistence, invalid values,
legacy keys, provider scope, real menu drafts, cancellation and filtered rows.
The existing remote, channel-search, native-font, playback and device suites
remain part of `npm test` / the browser gates.

These are automated browser/runtime checks, not physical-TV certification.
Distance legibility and hardware video-plane placement still need evaluation on
the intended receivers. The checked-in screenshot below uses synthetic channel
and EPG data with the production renderer and factory settings; it is not a
redrawn mockup or a claim about an actual broadcast.

![Studio 2026, factory settings with 25 channel rows](images/studio-2026-default.png)

## EPG dates and time appearance

The shared programme list shows the localized weekday and calendar date beside
each time range. A programme crossing midnight also shows its ending date.
Calendar labels follow the same player timezone as the clock, including a saved
UTC-offset override. Selecting a programme still uses its original provider
identity and timestamps. Full date/time labels in programme details, the archive
OSD and playback history use that same offset with or without Intl. The existing
player timezone setting uses a fixed offset; this change does not add historical
DST conversion to that setting.

Under **Channel list settings**, **EPG: “Archive”** controls the written Archive
label. It defaults to **yes**. Choosing **no** keeps the green availability marker
and archive playback; the marker retains its accessible label. The separate
channel-list archive setting keeps its existing purpose.

**EPG: Text color (00:00)** opens the same color spectrum picker as the Classic
interface colors. Left/Right changes hue and Up/Down changes saturation; **Set**
accepts the preview into the settings draft. **Player default** restores the
inherited theme color. Save the parent settings page to keep either change;
Cancel discards it. Only the date and time range changes, not programme-title
highlighting or the interface theme. Existing saved colors remain unchanged.
Both EPG settings apply to the shared EPG in Classic and Modern interfaces.

The `epgTimeColor` setting keeps the numeric `sEpgTimeColor` storage key: `0`
inherits the theme, and `1`–`5` retain white, yellow, cyan, green and light magenta.
Custom colors use `6 + hue * 101 + saturation`, with integer hue `0`–`360` and
saturation `0`–`100` (HSV brightness is `100`). The accepted numeric range is
`0`–`36466`; remote settings and profile imports use the same validation.
