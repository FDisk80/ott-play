# Play a desktop video by dropping it into the player

On PC, PC2, and the Tauri desktop shell, drop **one video file** into the player window to start temporary Local playback. This does not add a provider, import a folder, or replace the saved Local library. The configured provider remains saved for later use.

Only a single file is accepted. Dropping multiple files, a directory, or a file rejected by the format/type checks does not replace the current video. A drag cursor may show a copy symbol; the player does not copy the original media into its library.

The native player processes one file request at a time. Wait for that request to finish before dropping or opening another file; additional requests during validation or handoff are not queued.

## Browser playback

The browser reads the selected `File` through a temporary object URL. It does not upload the file to the OTT server or persist its bytes in browser storage.

The browser path accepts MP4, M4V, WebM, and MOV filenames. MKV additionally requires the browser to report Matroska playback capability. AVI is not accepted by this path. Actual playback still depends on the container and codecs supported by the browser and operating system; a filename or capability response is not a guarantee that every stream will decode.

If the browser blocks autoplay on a new page, press Play to start the selected file. The file remains selected; dropping it again is unnecessary.

## Tauri desktop playback

The native path accepts regular, non-symlink MP4, M4V, WebM, OGV, AVI, and MKV files. AVI/MKV use the existing Local compatibility backend and are rejected if it is unavailable. MOV is not part of the native Local format list in this implementation.

The original file is served on demand through the existing private loopback Local media routes. There is no media import, directory scan, or durable source registration. The file must remain available. Native reads recheck the opened file against captured metadata, including device/inode identity on Unix and volume/file identity on Windows. If Windows cannot read that identity, the file is rejected. This is not a snapshot of immutable file contents.

The application event `local-media-drop` carries an opaque grant. The main-window commands `local_media_take_drop` and `local_media_release_drop` consume or release that grant; neither accepts an arbitrary filesystem path. The returned catalog contains temporary HTTP playback URLs. A pending grant expires after 30 seconds, and at most two issued grants are retained during replacement. Releasing a rejected new grant leaves the previous grant intact.

This is a boundary for the new application API, not a claim that filesystem paths are hidden from the trusted Tauri frontend. Tauri's standard OS drag/drop events can themselves contain native paths. No additional filesystem-plugin or asset-protocol permission is introduced by this feature.

## Open With and default applications

The macOS and Linux packages advertise **MP4, M4V, WebM, OGV, AVI, and MKV** as native video types. On macOS, registration uses the `Viewer` role and `Alternate` rank. The application does not select itself as your default player. These declarations follow [Tauri's file-association configuration](https://v2.tauri.app/reference/config/#fileassociation).

### macOS: choose a player once or make it the default

After installing a package containing this feature:

1. In Finder, select one supported video file.
2. For this opening only, choose **File → Open With → OttPlay FOSS**.
3. To change the default for that file type, choose **File → Get Info**, expand **Open with**, and select the intended OttPlay application.
4. Click **Change All** only if you want that application to open all files of this type. Repeat with a representative file of another type if you also want to change its default.

These are the standard [Apple instructions for choosing an application to open a file](https://support.apple.com/en-bh/guide/mac-help/mh35597/mac). Choosing an app without **Change All** leaves the change limited to the selected file.

For a managed multi-instance installation, choose the copy explicitly: **OttPlay FOSS.app** is T1, while **OttPlay FOSS 2.app** is T2 (likewise T3/T4). Each copy has a distinct bundle identifier and instance environment. Use the identity-preserving installer when updating them so the chosen copy keeps its own settings; choosing T2 as the file-type default does not mean “whichever player is already open.” If the updated app is missing from **Open With**, its installation and application registration need checking before treating the feature as available.

The macOS implementation handles both a file that launches the chosen app and a file opened while that app is already running. At launch, it retains the file request until the player page is ready. For an already-running app, it restores the main window if minimized and offers the file to that instance. Both routes use the same temporary Local playback and access checks as a drop.

### Linux and Windows

Linux DEB/RPM packages include a desktop entry with video MIME types and file-argument forwarding. A standalone AppImage needs integration with the desktop environment before it appears in application menus or an **Open With** chooser; merely downloading the AppImage does not establish a menu entry. Choose the integrated application using your desktop's **Open With** or default-application settings.

Windows supports selecting the installed executable manually in **Open With**. Automatic Windows file-association registration is not enabled in this feature, so installation does not assign extension defaults.

On Windows and Linux, this implementation accepts the file argument when a process starts. Forwarding a second **Open With** request to an already-running process is not implemented. You can drop a file into the existing player window instead. Audio-only files, playlists and MOV are not registered as native video types.

AVI/MKV still require the existing compatibility backend, and supported extensions do not guarantee that every codec will play. Native package installation, Finder/desktop registration, and real cold/warm OS opening have not yet been verified for this change; the behavior above describes the implementation, not a completed native delivery test.

## Restrictions and cleanup

Drop playback is unavailable while kiosk mode is enabled or locked, while parental protection requires access to Providers or Settings, or while the player is in standby. It does not bypass these checks or open a protected configuration flow automatically.

An accepted replacement drop, an explicit provider change, or closing/reloading the page ends the previous temporary playback ownership and releases its object URL or native grant. A rejected pending drop leaves the current video intact. Standby suspends playback work while retaining the temporary source for resume after wake.

Dropped files are session-only. Reopening the application or browser page does not restore the dropped file; drop it again to play it. Saved provider and Local-library configuration continue to use their normal persistence behavior.
