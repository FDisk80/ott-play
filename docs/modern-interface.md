# Modern interface

Modern is an optional presentation of the same OTT-play catalogue, playback
session and controls. Classic remains available and remains the default for
new and existing installations.

## Enable or return to Classic

Open **Settings → Interface settings → Interface mode**, choose **Modern** or
**Classic**, and save. Cancelling the settings draft keeps the previous mode.
The preference is stored for the client, so selecting a provider or restarting
the player does not reset it.

The matching remote setting is `interfaceMode`:

```sh
ott t1 setting interfaceMode
ott t1 setting interfaceMode 1
ott t1 setting interfaceMode 0
```

`1` requests Modern; `0` selects Classic. Replace `t1` with the target player.
The stored key is `sInterfaceMode`; only integer values `0` and `1` are valid.
Unset or invalid saved values use Classic. The setting is application-scoped,
not part of an individual provider's settings.

Remote setting responses separate the saved value from `effective_value`.
While the renderer loads, application is reported as deferred with
`view_loading`; a failed load reports `effect_failed` while Classic remains
active. Read the setting again to confirm the effective mode.

**Interface mode** and **Interface theme** are separate settings. The theme
continues to control the existing palette, background and opacity settings.
Studio 2026 remains the default theme. Switching presentation preserves the
theme, including saved Classic custom colours. Modern adds its own consistent
card selection treatment and surface shapes.

## What changes

- The library fills the window, with a top navigation capsule for Home, the
  current library, Favorites and search. Provider and settings controls sit
  separately in the corner; category selection belongs to the catalogue
  heading. Available navigation follows the same provider and access rules
  as Classic.
- Media catalogues open in **Home**: a large selected-item backdrop, title,
  collection and available description above horizontal category shelves. Each
  source category keeps its own row and position; the All row also includes
  items without a category. Play
  and Description actions appear when the current screen supplies those
  actions. **Media library** switches to a poster grid of the same catalogue;
  it preserves selection and does not reload the source or start playback.
  The old split-screen preview does not take space away from the catalogue;
  playback continues in the same session.
- Live channel catalogues use larger rows with a number, channel identity,
  logo when available, programme text and progress. The focused row and the
  playing channel have distinct indicators.
- Media catalogues and mixed Favorites share both views. Home cards use a
  landscape artwork frame; Media library uses 2:3 posters. A title, available
  collection metadata and distinct playing/focus indicators identify each
  card. Plex uses `thumb` for posters and `art` for backdrops, with the other
  image as fallback; the access token is resolved at paint time and is never
  stored in catalogue records. Missing or failed artwork leaves a readable
  title and a simple letter placeholder.
  HTTP-only posters use the bounded native artwork bridge in Tauri and the
  local server bridge on HTTPS loopback pages. Hosted deployments need explicit
  HTTPS image-directory mappings. The visible window requests at most four
  bridged images at once and keeps a bounded, memory-only cache; leaving the
  source discards pending results. See [artwork transport](artwork-transport.md).
  VPortal previews show the synopsis rather than repeating the title, year and
  duration above it; Description keeps the full formatted source metadata.
- Settings and categories use a spacious single-column list inside the same
  navigation shell. Search and text entry use a scrollable editor with visible
  confirmation and cancellation controls. Context menus, dialogs, track
  selection and the playback OSD use the same surfaces and focus treatment.
- Playback uses an inset bottom sheet following the native LG presentation.
  Its background is 72% opaque, so the video remains visible underneath while
  text, icons and controls stay fully visible. Custom surface colours keep the
  same transparency.
  Context and a two-line title sit above one line of next-programme information
  or, when that is absent, the synopsis. A horizontal transport row sits below
  the metadata; the focused control expands to show its label. The timeline
  and its clocks follow the controls. On narrow screens the controls scroll
  horizontally so the last action remains reachable.
- The lower **Info** control opens the current programme or video's full
  description and available artwork. It reads playback metadata, independently
  of the last selected catalogue row. Long descriptions scroll by touch, wheel
  or Up/Down; Close and Back return to playback information.
- Favorites uses the existing client-wide store and source identity. Its
  indicator reports known membership and the toggle waits for the shared
  operation to finish. Channel list returns to the active mixed Favorites or
  provider view. Seek, audio and subtitle controls follow the current player's
  actual capabilities; changing the visual mode does not add decoder support.
- Previous and Next use the current shared media queue, channel list or mixed
  Favorites navigation. They appear only when that source proves a neighboring
  item; a media queue with repeat disabled stops at its bounds. Temporary
  playback commands retain the configured provider. These controls do not
  construct or persist a second playlist.
- The overlay follows live, archive and VOD state from the existing session.
  It opens on the normal info gesture or a pointer tap, auto-hides with the
  configured info timeout, and dismisses on Back, a click outside the panel or
  when a dialog, number entry, popup or list takes over. Play/Pause uses the
  same live pause, VOD resume and archive resume paths as Classic.
- Media descriptions, existing controls and their callbacks retain their
  original ownership. Actions and input handling remain shared with Classic.

This is a new presentation of the existing libraries, not a separate library
or recommendation service. System file pickers and operating-system permission
dialogs retain their native appearance.

## Navigation and shared state

In a poster grid, Left/Right move between cards and Up/Down move by the visible
column count. At list boundaries the selection stays within the available
items. Enter/OK activates the selected item through the same action as Classic.
Back, category selection, search and context actions retain their existing
behavior. Channel catalogues retain their linear navigation.

Home uses the categories supplied by channel-backed media catalogues and Plex.
Left/Right stay within the current category; Up/Down and the mouse wheel move
between category rows. Returning to a row restores its previous position.
Touch swipes follow the same row and card navigation. Clicking a different card
selects its exact category occurrence; clicking the selected card or pressing
Enter/OK activates the existing host action. No decoder is started merely by
changing the presentation. Mixed global Favorites keeps its own shared list,
and screens without a category projection retain the single-row Home view.

Up from the first visible grid row enters the top navigation. In Home it
first reaches the selected item's Play/Description actions when available;
another Up reaches the navigation capsule. Left/Right move between actions.
Down returns through the Home actions to the same selected catalogue item;
Back returns directly to it. Home and Media library change presentation only;
Favorites, search, category, provider and settings controls use the existing
host routes. An open text editor or confirmation dialog keeps input ownership
until it closes; covered navigation cannot change the provider behind it.
Option pages do not expose a hidden catalogue-category action.

During full-screen playback with playback controls inactive, the default **Up**
button selects the next channel or file and **Down** selects the previous one,
in both Classic and Modern. This
also applies while watching an archive or VOD item. Navigation follows the
current category, mixed Favorites or temporary media queue, including its
existing order and wrapping policy. Custom mappings apply when an active queue
or control panel does not own the buttons; the separate minute-seek actions
remain available. Temporary Plex queues keep their existing Up/Down behavior:
next/previous item in the queue.

An information banner displayed automatically after a channel or programme
change is passive. It does not focus the scrubber or take over the playback
keys: repeated Up/Down presses continue through the list, and ordinary PC
Left/Right presses keep controlling volume. Info or a pointer action opens the
interactive controls. Enter/OK activates their keyboard navigation when the
automatic banner is already visible; when the banner is hidden, Enter/OK keeps
its normal playback or channel/media-list action.
Programme updates and seek feedback retain the current interaction mode. If
you open the controls while a new item is loading, its later arrival does not
take away that focus. A newly accepted channel, Favorite or queue selection
starts with passive information again.

On PC, showing playback information alone does not take over the arrow keys:
Left/Right keep controlling volume and Up/Down keep selecting the next/previous
item. Tab or directly selecting a control enters control navigation. The
existing modified-arrow seek shortcuts still reach the shared playback handler.
With deliberate control focus, Left/Right seek on the scrubber or move between
buttons in the action row, and Enter activates the selected control.

Remote navigation follows the vertical layout: Up from the timeline reaches
the action row; Down reaches the lower Info control when available. Down from
the actions and Up from Info return to the timeline. Up from the action row
and Back dismiss the panel. A dialog or text entry keeps input priority.
Kiosk restrictions remain
in force and are not relaxed by switching the presentation.

The two modes share the current provider, category, global Favorites, selected
item, source order, playback position, volume and track choices. Switching the
mode redraws the visible catalogue; it does not reload the playlist, restart
the decoder or create a new Favorites store. A different number of visible
cards may move the selected item's screen position while keeping the same
selection.

## Large libraries and small screens

The grid renders only the current page. It does not create an image element
for every item in a large local, Plex or VPortal catalogue. Existing background
catalogue loading and source availability rules still apply.

Column and row capacity adapt to the available catalogue area and interface
font scale. Category Home mounts at most two rows of eight cards, advancing the
visible window as the selection moves; single-row sources mount at most eight
cards. Media library mounts at most two rows and sixteen cards. Category
membership is retained by the host rather than flattened or copied on repaint.
The top navigation becomes more compact
on narrow windows; text editors and dialogs remain scrollable. Modern does
not overwrite the saved Classic row count. The
existing font family and **Font size, %** setting continue to apply; subtitle
styling remains separate. Focus decoration avoids layout-changing animation,
and the small decoration transitions are disabled when the platform requests
reduced motion. No backdrop blur, new web font or external artwork service is
required.

The shared web presentation does not synthesize chapter markers or a credits
countdown when the current provider/player does not supply those capabilities.
Native-only playback features remain platform-specific. The native LG package
has its own build; this frontend change reaches the web, Tauri and Capacitor
packages through their shared Modern asset.

The playback reference is the installed native LG 0.3.0 build from FOSS
`609f1b5dd3df3613164b65f91d98603a0638a299`, rather than an unverified current
branch. Its inset sheet, metadata hierarchy, focused button captions and
actions–timeline–Info navigation are adapted to the existing web theme and
responsive layout. The web implementation retains its shared progress element,
provider commands and decoder; the elapsed clock stays below the timeline's
left edge. This is a common frontend implementation, not an embedded native
LG executable.

## Availability and fallback

The shared browser, OTT-server, Tauri and Capacitor frontend uses the same
Modern presentation asset. TV wrappers loading that frontend use the same
setting. A device must receive the updated frontend and its matching optional
asset before Modern can be used; this is not a claim that every physical TV
model has been certified.

Classic startup does not load the Modern JavaScript asset. When Modern is
requested, the player loads that asset with a bounded timeout. If it cannot be
loaded or initialized, or the rendering engine lacks CSS Grid support, Classic
remains usable and the player displays a message. The requested preference is
retained separately from the effective
mode. Select Classic, then Modern to retry; verify the installed frontend
version and asset availability if the message returns.

## Implementation and validation

The catalogue, playback overlay and focus treatment are an independent
implementation built on the player's existing HTML/CSS, fonts, data models and
actions. No third-party source code, logo, screenshots or demonstration artwork
is bundled. Runtime artwork comes from the selected provider or media source.

The overlay is one optional asset with the catalogue renderer; Classic startup
loads neither. Its layout is responsive from phone portrait and landscape to
the ten-foot television layout, honors safe-area insets, uses semantic buttons
and a slider, and keeps at least 44 CSS-pixel touch targets. Release validation
must cover the actual frontend bundles, settings persistence, switching while
playing, keyboard/pointer/touch navigation, dialogs and number entry over
playback, missing artwork and the responsive layouts.
