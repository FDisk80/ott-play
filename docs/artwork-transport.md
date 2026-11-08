# Provider artwork transport

An HTTPS player document can upgrade an HTTP poster URL to HTTPS even when its
provider serves the original JPEG successfully. Keep the provider URL unchanged;
do not weaken the application's transport security or pretend the provider has TLS.

The Rust artwork transport reads the original HTTP(S) resource and returns bounded
raster bytes. It accepts PNG, JPEG, GIF and WebP binary signatures only. HTML, SVG
and unknown signatures are rejected regardless of the upstream Content-Type.
There is no persistent image cache or import into the media library.

## Tauri

Call `invoke('artwork_fetch', { url })`. Success resolves to:

```json
{ "contentType": "image/jpeg", "bodyBase64": "..." }
```

Decode the standard Base64 into a Blob with the supplied MIME. A caller must
discard stale results and revoke Blob URLs when artwork changes or its view is
disposed. This command participates in the instance's BackgroundWork cancellation:
standby rejects new requests and drops in-flight network work. There is no separate
per-request IPC cancellation command; superseded work remains bounded by its deadline.
The existing `proxy_http` and `proxy_fetch` APIs remain text-only.
Setting `OTTPLAY_WEB_URL` changes the loaded page, not its native permissions.
Remote pages outside the existing capability origins cannot invoke this command.
An explicitly configured hosted image-directory mapping is used before native
IPC, including when that hosted page runs inside Tauri. An unavailable or denied
native request is terminal; it is not retried through an unrestricted image URL.

## Local OTT-server (Mode A)

`POST /artwork` accepts `application/json` with exactly `{ "url": "http://..." }`.
Success returns raw raster bytes with a signature-derived Content-Type,
`X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.

The route is for a player served by the same local server. It requires an actual
loopback TCP peer, a Host of localhost, 127.0.0.1 or ::1, and a matching browser
Origin authority when supplied. Cross-site fetch metadata and forwarding headers
are rejected. The route is outside permissive asset CORS; it is not a public or LAN
relay and must not be exposed through a reverse proxy that rewrites these checks.
Missing authorization context fails closed. Forwarded headers never grant access.

Errors are sanitized: 400 invalid input, 403 local/destination policy, 413 request
too large, 415 unsupported raster format, 503 capacity, 504 timeout, otherwise 502.
No URL, query token, upstream body, cookie or header is reflected in errors.
Aborting a browser fetch stops result consumption; server work can remain active
until its bounded deadline. No server request cancellation endpoint is provided.

## Shared bounds and deployment limits

- Request body: 8 KiB; URL: 4096 bytes, HTTP(S), no userinfo or fragment.
- Response: 4 MiB, checked both before and during reading; 10 seconds for the whole
  operation including DNS, up to five redirects and body reads.
- Existing shared proxy admission: at most eight active requests, with at most
  four used by artwork. Artwork alone cannot exhaust the capacity needed by
  playlists, even during rapid replacement. Busy requests are rejected immediately
  rather than queued.
  Blocking DNS retains its artwork admission until lookup exits, including after
  cancellation; DNS also has its own existing bounded slots.
- Every redirect must retain the original origin and contain no userinfo or
  fragment. Every hop uses checked, pinned DNS addresses. Ambient proxies are ignored.
- Private destinations are denied by default. Existing `OTTPLAY_PROXY_LAN_ORIGINS`
  exact literal RFC1918/ULA origin policy applies; loopback and link-local targets
  cannot be enabled with it. No caller-supplied auth headers or cookies are forwarded.

Static here.now and other hosted players need an explicitly mapped, scoped HTTPS
artwork gateway. They cannot use this local arbitrary-URL route. No gateway is
published or enabled by adding this API. Capacitor's current generic HTTP bridge is
text-only and must not be used to decode image bytes; native binary bridge support
is a separate platform change. Direct image loading can still work where the
platform allows the actual image URL. Client adapters should feature-detect the
bridge and retain a normal placeholder on denied or unavailable artwork.

## Hosted image-directory mappings

The Modern frontend accepts deployment-owned mappings in
`window.__OTTPLAY_HOSTED__.artwork.routes` when the deployment has `version: 1`:

```json
{
  "upstream": "http://images.example/posters/",
  "path": "/vportal/artwork/provider-1/posters/"
}
```

Configure the hosting proxy for that same fixed origin and directory. The
frontend accepts only a single image filename below the directory (PNG, JPEG,
GIF or WebP), with no query, credentials, fragment or path traversal. Unmatched
HTTP origins on HTTPS pages remain unavailable. These are deployment settings,
not a public arbitrary-URL proxy; merge them into the existing hosted configuration
without replacing its other profiles or routes.

The adapter deduplicates visible requests, admits four bridged fetches at a time,
and retains at most 16 images / 8 MiB in memory. It revokes temporary Blob URLs,
rejects retired-view results and cancels obsolete local-server XHRs. Capacitor
retains its configured native direct-image path; this change does not add a binary
Capacitor bridge or prove compatibility with every device network policy.
Inline image data has a separate length limit (the Base64 size of 4 MiB plus
128 characters for its prefix), so it is not rejected by the 4096-character
network URL limit. Inline data is rendered directly without a bridge request.
