# Build the TS bundle (dist/player.js)
FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json vite.config.ts ./
COPY src ./src
# Keep the build helpers together so new transitive dependencies are available.
# The final image receives only the validated web root, not these scripts.
COPY scripts ./scripts
COPY LICENSE ./
COPY licenses/android/Apache-2.0.txt ./licenses/android/Apache-2.0.txt
COPY licenses/native ./licenses/native
COPY vendor/ottplay-core.js vendor/ottplay-core.manifest.json vendor/ottplay-core.LICENSE.txt ./vendor/
COPY vendor/hosted-epg ./vendor/hosted-epg
COPY index.html favicon.ico ./
COPY fonts ./fonts
COPY js ./js
COPY devices ./devices
COPY styles ./styles
COPY images ./images
COPY locales ./locales
COPY providers ./providers
COPY src-tauri/pip ./src-tauri/pip
RUN npm run typecheck && npm run build:server

# Resolve the server workspace before the target compilation cache boundary.
# Desktop release version changes must not invalidate unchanged server inputs.
FROM --platform=$BUILDPLATFORM rust:1.99-alpine@sha256:44819b27be4c97b0e4d7203bd2e02c4820f97700211b6a37fb4c246a2de59383 AS server-inputs
RUN apk add --no-cache python3
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY vendor ./vendor
COPY src-rs ./src-rs
COPY plugins ./plugins
COPY scripts/prepare-container-workspace.py ./scripts/prepare-container-workspace.py
RUN python3 scripts/prepare-container-workspace.py --workspace /app --output /prepared

# Build Rust server against musl so the published image does not need
# GLIBC_2.38+ (Hub :latest built on a newer glibc toolchain failed on
# Synology DSM Docker / x86_64). Alpine = musl host target by default.
FROM rust:1.99-alpine@sha256:44819b27be4c97b0e4d7203bd2e02c4820f97700211b6a37fb4c246a2de59383 AS rust-build
RUN apk add --no-cache musl-dev build-base
WORKDIR /app
COPY --from=server-inputs /prepared/Cargo.toml /prepared/Cargo.lock ./
COPY vendor ./vendor
COPY src-rs ./src-rs
COPY plugins ./plugins
RUN cargo build --locked --release --bin ottplay-server

# Musl runtime (no glibc). ca-certificates for outbound HTTPS (EPG / M3U).
FROM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS server-runtime
RUN apk add --no-cache ca-certificates \
 && adduser -D -H -u 65532 -g nonroot nonroot
WORKDIR /app
COPY --from=rust-build /app/target/release/ottplay-server ./ottplay-server
USER nonroot
EXPOSE 8080
CMD ["./ottplay-server", "--port", "8080"]

# The public guide needs only the native binary. Selecting this target does not
# build or copy the player frontend, and keeps the shared runtime restrictions.
FROM server-runtime AS epg
ENV EPG_ONLY=true

# Keep the default image as the complete player server, without EPG_ONLY set.
FROM server-runtime AS player
# Use the validated web root, including the runtime-only player image allowlist.
# Copying source trees here would reintroduce retired and private assets.
COPY --from=build /app/dist/index.html ./index.html
COPY --from=build /app/dist/favicon.ico ./favicon.ico
COPY --from=build /app/dist/dist ./dist
COPY --from=build /app/dist/fonts ./fonts
COPY --from=build /app/dist/js ./js
COPY --from=build /app/dist/devices ./devices
COPY --from=build /app/dist/styles ./styles
COPY --from=build /app/dist/images ./images
COPY --from=build /app/dist/locales ./locales
COPY --from=build /app/dist/providers ./providers
