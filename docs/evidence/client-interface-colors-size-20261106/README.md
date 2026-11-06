# Client interface color size evidence

These files preserve the original inputs and inventories from [hosted run 42219826374](https://github.com/open-ott-play/ottplay-foss/actions/runs/42219826374). Both arms used source commit `14ea5da80b20a8311bb55cee250f794ae278d310`, the same dirty build identity, Node 22.23.4, and zlib 1.3.1-e00f703. The candidate applied the color feature patch recorded in `manifest.json`. PR #1073 is a separate budget correction and is not part of this measured feature delta.

The original comparison **failed**. Its bound count expected 78 baseline and 81 candidate root JavaScript files, while the collector correctly also found `dist/offline-worker.js`: 79 and 82 files. Consequently `receipt.json` retains `complete: false`, its original error, and `allCommandsPassed: false`; no original `comparison.json` was produced. Baseline commands passed. Candidate build and size commands returned 1 against the old budget, and collection succeeded for both arms. This evidence is not a successful build or release qualification.

The regression test reads the preserved inventories directly. It verifies their hashes against the original receipt, all source identities, exact module paths, per-file deltas, and totals. Removing only the explicitly identified worker from budget accounting leaves the expected 78 and 81 classic JavaScript assets. Each of the three targets has the following byte changes (raw / separately gzip level 9 compressed):

- Main entry: **8,796 / 2,501**.
- Edem provider: **44 / 18**.
- Subtitle appearance module: **529 / 215**.
- Remote settings lifecycle module: **334 / 145**.
- New color editor module: **10,444 / 4,378**.

The allowances are the nonnegative maximum for each component across web, Tauri, and mobile, not the sum across targets. The resulting full classic payload increase is **20,147 / 7,257** per target. Only the entry allowance changes the entry limit. Entry and provider changes affect the legacy total; all five affect the complete total. Edem remains within its unchanged individual provider limit. Unrelated module limits remain unchanged.

The worker changes by **27 / 3** and is checked separately, outside the classic size gate. Stylesheets remain identical. Locale updates are retained in the inventories and checked against the feature manifest; their cost is not mislabeled as classic JavaScript. Android Play's reduced provider set is not one of the three measured targets.

`DATA-VERIFY.json` and `DATA-COMPARISON.json` preserve the subsequent data-only reconciliation of all 734 archive files. They do not replace the failed original receipt. The regression test also verifies the supplemental comparison against every original inventory row.

Separately, all 703 collected assets (350 baseline, 353 candidate) were checked against their preserved raw bytes with the frozen production `collectBundleMeasurement` export and the same Node/zlib versions; `raw-verification.json` records this additional check. Every byte count, gzip size, and SHA-256 matched. The supplemental reconciliation itself did not recompute gzip. The raw files remain in the hosted artifact; this directory stores the original and supplemental JSON records unchanged. The existing release pipeline must still qualify the final combined source.
