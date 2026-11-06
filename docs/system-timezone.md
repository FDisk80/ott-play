# System timezone

The System timezone setting uses the operating system timezone for each date.
It follows timezone changes without restarting the shared web player and uses
the applicable daylight-saving offset for the date being displayed. This
behavior applies to the shared player in browsers, OTT server, Tauri,
Capacitor, and the hosted webOS application.

Explicit UTC and GMT offsets remain fixed. They do not follow later system
timezone changes or daylight-saving transitions. Existing saved timezone
choices keep their meaning; System and explicit UTC are separate choices.

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
