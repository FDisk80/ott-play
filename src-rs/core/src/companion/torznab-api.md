# Local Torznab API, schema 1

All routes are below the existing private `/companion/:token/v1` endpoint.
Configuration is an operator API. Credentials and source addresses are never
returned by these routes or exported with player profiles.

- `GET /torrent/sources`: `{schema:1,sources:[{id,label}]}`.
- `POST /torrent/sources`: `{id,label,endpoint,apiKey}`; response
  `{schema:1,source:{id,label}}`. Upsert; changed endpoint/key invalidates that
  source's previous result and stable references. Label-only changes preserve them.
- `DELETE /torrent/sources/:id`: `{schema:1,removed:true}`.
- `GET /torrent/sources/:id/indexers`: `{schema:1,sourceId,supported,indexers:[{id,label,language,type}]}`.
- `GET /torrent/sources/:id/caps`: `{schema:1,sourceId,searchAvailable,categories:[{id,name,parentId}],maxLimit}`.
- `POST /torrent/search`: `{sourceId,query,categoryIds:[],offset:0,limit:100}`;
  response `{schema:1,sourceId,items:[{resultRef,title,size,seeders,publishedAt,categoryIds,languages}],nextOffset,total}`.
- `POST /torrent/prepare`: `{sourceId,resultRef}`; response
  `{schema:1,sourceId,sourceRef}`. Fetches metadata, not media content.
- `POST /sessions`: existing `{source,fileIndex?}` or
  `{sourceId,sourceRef,fileIndex?}`, exclusively. Subsequent session APIs are unchanged.

Source IDs match `^[a-z][a-z0-9-]{0,63}$`. Both reference kinds match
`^[0-9a-f]{32}$`. Player persistence uses exactly
`ottplay-local-torrent:SOURCEID/SOURCEREF` without query, fragment, or encoding.

## Choosing one configured Jackett indexer

The companion advertises `localTorznabChildren: true` in `/capabilities` when
these routes are available. It is an additive capability: older clients and
ordinary single-feed Torznab sources retain their existing behavior.

Configure Jackett's aggregate feed, for example
`https://jackett.home/proxy/api/v2.0/indexers/all/results/torznab/api`.
The `indexers` route requests that feed with `t=indexers&configured=true`.
This lists configuration metadata; it does not search every tracker. The
companion returns only safe IDs, labels, language and type, never tracker
homepages, upstream URLs or credentials. Empty metadata is `null`. At most
256 configured children are returned.

Pass one returned ID as `?indexerId=ChildA` on the `caps` route, or as the
optional `indexerId` string in the `search` JSON body. A successful response
echoes the same ID. IDs are case-sensitive and match
`^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`; `all` in any casing is forbidden as a
child selector. Filters, paths, encoded paths, empty values and unknown IDs
are rejected; the literal safe IDs `filter` and `Filter` are still allowed.
Omit the field entirely for the original aggregate operation.
`null` does not mean “all”. Discovery itself takes no selector or other query
parameters. The configured source is not modified by a child request.

Only a recognized `/api/v2.0/indexers/all/results/torznab` aggregate path,
optionally ending in `/api` or a trailing slash, supports child selection.
Its HTTPS origin, proxy prefix and suffix are preserved when constructing a
child endpoint. Other configured feeds return `supported:false,indexers:[]`;
they remain usable through ordinary caps/search. Authentication errors,
timeouts, malformed XML and failed child operations remain errors. They never
retry through the aggregate feed or return another child's cached results.

Caps and transient result handles are bound to source ID, configuration
generation and exact child ID. The caps cache holds at most 32 scopes.
Discovery metadata is cached for up to 60 seconds for scoped requests. Concurrent
first-use requests share one discovery, with each caller retaining its own deadline
and cancellation. An
explicit `indexers` request refreshes it and revokes transient data belonging
to removed children. Older discovery responses cannot overwrite a newer refresh. An in-flight
operation cannot publish a removed child's result, even if a later refresh
reintroduces the same ID; a new private membership epoch distinguishes it. Download links are resolved against the selected
child endpoint and retain the existing same-origin rule, including rejection
of HTTPS-to-HTTP downgrade. Upstream proxy misconfiguration is not repaired
by guessing a different origin.

`prepare` is unchanged: send only `sourceId` and `resultRef`. Its opaque result
handle already contains the child scope and resolved download URL. Stable
`sourceRef` values continue to deduplicate the exact metainfo or full magnet
within a source generation, survive restart, and work through the existing
session API. No profile or stored-reference migration is needed.

The player-facing command envelope remains `torrent_indexer` version 1.
A native adapter advertises the optional `torrent_indexer_children` version 1
capability (`operations:["indexers"]`, `scopedOperations:["caps","search"]`)
only when its ready companion reports `localTorznabChildren`. The capability
does not imply that every configured source supports enumeration.

Maximum UTF-8 byte lengths: label 128, endpoint 4096, API key 2048, query 512,
title 1024, category name 128, language 32, publication timestamp 64.
Control characters are rejected. RSS search-item language values contain ASCII
letters, digits or hyphens. Discovery `language` and `type` values are nullable
UTF-8 metadata, each limited to 32 bytes, as specified by the children contract.
Publication timestamps are RFC3339 strings, normalized from RSS
pubDate, or null. Unknown metadata is null, not invented.

At most 8 sources, 100 items per page, 512 categories, 32 category IDs per item,
16 languages per item. Numeric metadata is an integer between zero and
9007199254740991; category IDs and non-null parent IDs are positive.
`size`, `seeders`, `publishedAt`, `parentId`, `total`, `nextOffset` are nullable.
Input offset is 0..1000000, limit is 1..100, categoryIds has at most 16 entries
and must refer to advertised categories. maxLimit is 1..100. nextOffset is at
most 1000000. Clients request further pages explicitly.

The companion keeps at most 512 transient result handles for 15 minutes.
Repeated results reuse their handle while retained. Stable references survive
restart, deduplicate exact original metainfo/full magnet per source generation,
and are capped at 128 references and 64 MiB. There is no silent stable eviction.
Private state is `COMPANION_ROOT/torznab-private/state.json`; payload files and
the owner lock are in the same private directory, separate from the piece cache.

Only explicitly configured loopback/private-IP origins are used. DNS answers
are checked and pinned per request; ambient proxies and HTTP redirects are
disabled. Download links must use the source's origin. An explicit redirect
to a valid magnet is retained in full without forwarding credentials. Original
torrent bytes are retained unchanged. This does not extend the engine's
private-tracker support or add ratio/seeding policies.

Errors have `{schema:1,error:CODE}`. Codes from these routes are:
`invalid_request`, `unauthorized`, `service_stopped`, `torznab_invalid_source`,
`torznab_local_only`, `torznab_invalid_link`, `torznab_invalid_query`,
`torznab_invalid_category`, `torznab_search_unavailable`, `torznab_source_missing`,
`torznab_source_changed`, `torznab_reference_missing`, `torznab_busy`,
`torznab_cancelled`, `torznab_timeout`, `torznab_network_error`,
`torznab_http_error`, `torznab_response_limit`, `torznab_invalid_xml`,
`torznab_invalid_indexer`, `torznab_indexer_missing`, `torznab_indexers_unsupported`,
`torznab_xml_limit`, `torznab_api_error`, `torznab_invalid_page`,
`torznab_store_unavailable`, `torznab_store_busy`, `torznab_store_limit`,
`torznab_source_limit`, and existing metadata admission codes `invalid_source`,
`invalid_tracker`, `file_selection_required`, `metadata_limit`,
`invalid_metadata`, `tracker_limit`.

At most two remote operations run concurrently. Each remote operation has a
15-second total deadline including cold caps, DNS and response reads. Caps responses are
limited to 256 KiB, search to 2 MiB, metainfo to 1 MiB. Changing/removing a source
or shutting down cancels its pending requests; late results cannot publish handles.

## Local player acceptance fixture

`companion::torznab_fixture::serve_local_video_fixture` is an ignored test, not
a production endpoint. Supply a synthetic MP4 of at most 16 MiB. For example,
generate six seconds of test pattern and tone with a local FFmpeg installation:

```sh
ffmpeg -f lavfi -i testsrc2=duration=6:size=320x180:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000:duration=6 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart /tmp/ott-local-fixture.mp4
OTT_TORZNAB_FIXTURE_VIDEO=/tmp/ott-local-fixture.mp4 OTT_TORZNAB_FIXTURE_SECONDS=600 cargo test -p ottplay-core --lib companion::torznab_fixture::serve_local_video_fixture -- --ignored --exact --nocapture
```

The test prints its loopback Torznab endpoint, static fixture API key and bounded
lifetime (maximum 1800 seconds). Configure that endpoint as a separate source
with ID `local-fixture` through the authenticated operator API. Search, prepare,
and play the one synthetic result. Remove this source after acceptance.

The fixture includes a loopback HTTP tracker and a loopback-only seeder. Its
torrent is private and has only this tracker, so production clients do not need
test hooks or external discovery. The seeder disables DHT, trackers, and LAN
discovery. No public tracker, indexer or copyrighted clip is needed. To run
alongside a native build, compile this test once and invoke the emitted test
binary directly with the same test name/arguments and environment variables.


The selected-child byte-path acceptance test reuses this loopback tracker and
seeder through the production companion HTTP API:

```sh
OTT_TORZNAB_FIXTURE_VIDEO=/absolute/path/to/licensed-movie.mp4 cargo test -p ottplay-core --lib companion::torznab_fixture::selected_child_movie_first_bytes_seek_and_stop -- --ignored --exact --nocapture
```

Supply a regular MP4 of 128 KiB to 16 MiB that you are entitled to use. The test
selects the fixture's `OpenMovie` child, prepares its opaque result, verifies
initial, forward and backward HTTP byte ranges against the original file, and
holds the production stream body after one chunk while sending HTTP Stop. This
avoids mistaking a fully buffered response for an active reader. It then checks
that the reader ends and the lease and downloaded piece files are
gone. It does not verify a physical display, decoder output or a public swarm.
The normal suite exercises the same route with deterministic protocol bytes.
