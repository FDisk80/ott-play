# System timezone

The System timezone setting uses the operating system timezone for each date.
It follows timezone changes without restarting the shared web player and uses
the applicable daylight-saving offset for the date being displayed. This
behavior applies to the shared player in browsers, OTT server, Tauri,
Capacitor, and the hosted webOS application.

Explicit UTC and GMT offsets remain fixed. They do not follow later system
timezone changes or daylight-saving transitions. Existing saved timezone
choices keep their meaning; System and explicit UTC are separate choices.

New settings default to **System**. The Interface selector also offers fixed
UTC offsets from −12:00 through +14:00, including supported half-hour and
quarter-hour offsets. System is localized; fixed offsets use `UTC±HH:MM`.
Saved values are stable choice IDs, not hours: `0` means System and `1` means
explicit UTC+00:00. All original IDs `0`–`25` retain their meanings.

The additional offsets use IDs `26`–`40` and require an updated client. Older
clients reject these IDs in typed settings imports and fall back to System
when reading an unsupported raw saved value. No automatic migration rewrites
an existing explicit offset. A newer settings panel running on an older host
shows the host's complete original 26 choices.

Timezone selection changes displayed clock and programme times. It does not
change the device clock, Unix timestamps, programme identifiers, or the
archive start timestamp sent to the provider. It does not synchronize an
incorrect system clock.

The separate native webOS application uses the platform local-time conversion
and is not changed by this shared-player update.

## Regression coverage

Run `node tests/test_system_timezone.cjs`. The source-level suite covers UTC,
GMT+2, a half-hour offset, runtime timezone changes, both daylight-saving
transitions, fixed overrides, reset to System, repeated initialization,
native date setters, UI clocks, and guide-to-archive timestamp preservation.
