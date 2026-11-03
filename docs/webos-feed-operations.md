# Operate the LG Homebrew metadata endpoint

Homebrew Channel loads its catalog, app manifest and HTML description through
browser XMLHttpRequest. GitHub release downloads do not supply the CORS response
headers this requires. The public metadata endpoint serves those exact released
bytes with `Access-Control-Allow-Origin: *`:

```text
https://ottplay-webos.igw-2560801.workers.dev/v1/<release-tag>/ottplay-foss-webos-repository.json
```

The Worker accepts only the declared hosted and native metadata/artwork filenames for
`open-ott-play/ottplay-foss`, under an exact release tag. It has no credentials,
provider data or storage bindings. It does not relay video or IPKs. Homebrew's
installation service downloads the IPK directly from GitHub and verifies the
SHA-256 recorded in the manifest.

The separate native Plex application uses tags such as
`native-webos-v0.1.0-beta.1` and `ottplay-native-webos-repository.json`.
Hosted release tags cannot serve native metadata, and native tags cannot serve
hosted metadata. Both routes use the same read-only endpoint and CORS rules.

## Deployment

The reviewed implementation is `scripts/webos-feed-worker.mjs`; its Cloudflare
configuration is `webos/wrangler.jsonc`. With an operator-installed Wrangler CLI,
the appropriate Cloudflare account and a scoped Workers deployment token:

```sh
wrangler deploy --config webos/wrangler.jsonc
```

Supply authentication through Wrangler's login or standard Cloudflare environment
variables. Do not commit credentials. See
[Cloudflare's deployment documentation](https://developers.cloudflare.com/workers/wrangler/commands/#deploy).
The production endpoint uses the `igw-2560801.workers.dev` account namespace.
Deploying the same name into another account does not update that endpoint.
Changing the endpoint requires updating the generator and installation guide,
then publishing new release metadata.

Deployments of this small HTTP adapter are independent of application release
publication. New releases need no Worker redeployment: it reads the allowed files
from the requested immutable release. Keep earlier release assets available so
their installed repository snapshots continue to work. There is no moving
`latest` or automatic beta subscription endpoint.

## Verify a release

After publication, request the repository with an explicit `Origin: null` and
verify a successful response, JSON content type and
`Access-Control-Allow-Origin: *`. Follow its `manifestUrl` and `iconUri`, and
`fullDescriptionUrl` when present; compare each response's SHA-256 with the
corresponding original GitHub release asset. Download the manifest's IPK URL
and verify `ipkHash.sha256`.
Check that its app ID, numeric package version and release sidecar agree.

Run `npm run test:webos` before deploying a code change. A successful HTTP check
proves metadata delivery, not installation or decoding on a real LG television.
If the metadata endpoint is unavailable, the installed hosted player still
loads the canonical player site, while the separate native application runs its
installed code. Media sources must still be reachable. New installations can
use the Developer Mode IPK route. Do not point Homebrew directly at the non-CORS
GitHub JSON as a fallback.
