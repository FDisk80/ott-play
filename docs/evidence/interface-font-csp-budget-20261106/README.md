# Font preview CSP asset ceiling correction

The ordinary Build for `c05462ca5e11f33fefbe570534ffd8e708feb3af` failed exactly six size checks: raw and gzip limits for `subtitle-appearance.js` in web, Tauri and mobile outputs. All three measured 9,256 raw / 4,004 gzip bytes against 9,221 / 3,918 limits. There were no input errors or other size violations.

Increase only this optional asset ceiling by the remaining shortfall: **35 raw / 86 gzip bytes**, with **zero additional reserve**. Entry, provider, every other optional asset, and all aggregate ceilings remain unchanged. Measured file bytes already contribute to payload totals; a second aggregate allowance would count this correction unnecessarily.

The preceding `fc17579` report measured this asset at 8,823 / 3,869. Thus the observed increase was 433 / 135, of which existing headroom covered 398 / 49. Both reports used Node 22.23.4 and zlib 1.3.1-e00f703, but their heads and merge identities differ. These numbers are an observed comparison, not an isolated feature-cost experiment. The newer head changes the font preview to nonce-authorized CSS classes and retains the existing native/browser font choices.

`record.json` binds both unmodified reports, their identities, per-target hashes, deltas and the correction. `actual-diagnostics.json` retains the failed Build's original six violations. `baseline-report.json` retains its earlier successful size measurements. Neither report is relabeled as a new successful build. Historical color evidence and allowances are untouched.

Replaying these recorded measurements with the new ceiling checks the accounting only. The final combined head still needs its normal emitted-artifact and functional gates. No additional experiment or local build is needed to justify this measured shortfall correction.

The two original reports are immutable CI evidence: reformatting would change their recorded SHA-256 digests. `biome.json` exempts only `baseline-report.json` in this directory from formatting because its original array layout differs from the current formatter. Parsing and lint configuration remain unchanged. `actual-diagnostics.json` and the generated `record.json` use normal formatting and are not exempted.
