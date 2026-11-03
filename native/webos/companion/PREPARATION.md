# Reproducible companion preparation

`prepare.py` prepares inputs only. It installs the exact Rust release and ARM
standard library through an existing `rustup`, fetches the entire workspace
lock into an explicit Cargo cache, and verifies the official Rust source
archive. It never compiles, changes the default toolchain, installs OS packages,
or starts a player. On Ubuntu 24.04 ARM, install `libclang-18-dev` first.

Run these stages sequentially. Keep the same checkout, cache and target directory
through preparation, build, source collection and final SDK attestation:

```sh
python3 native/webos/companion/prepare.py \
  --cache-dir "$RUNNER_TEMP/companion-cache" \
  --target-dir "$RUNNER_TEMP/companion-target" \
  --output "$RUNNER_TEMP/companion-prepared.json"
```

Standard output is a single JSON object; progress/errors go to standard error.
The optional `--libclang` accepts a host library or its directory. Explicit files
must use a filename discoverable by clang-sys; `libclang-cpp` is not accepted.
The selected file path, including a valid distribution symlink alias, is retained
in `libclang`, `libclang_library` and `environment.LIBCLANG_PATH`. Later steps use
that exact file rather than rediscovering another library in its directory. The receipt's
`environment` object must be passed to **both** subsequent subprocesses. It sets
the prepared Cargo cache, pinned toolchain, two build jobs, no incremental build,
offline dependency access and the checked libclang file. For example:

```python
import json
import os
import subprocess
import sys

with open(os.environ["RUNNER_TEMP"] + "/companion-prepared.json") as stream:
    prepared = json.load(stream)
environment = {**os.environ, **prepared["environment"]}
bundle = os.environ["RUNNER_TEMP"] + "/companion-bundle"
subprocess.run([
    sys.executable, "native/webos/companion/build.py", "build",
    "--sdk", os.environ["WEBOS_SDK"],
    "--sdk-archive", os.environ["WEBOS_SDK_ARCHIVE"],
    "--target-dir", prepared["target_dir"], "--libclang", prepared["libclang"],
    "--jobs", "2", "--output", bundle,
], env=environment, check=True)
subprocess.run([
    sys.executable, "native/webos/companion/sources.py",
    "--bundle", bundle,
    "--output", os.environ["RUNNER_TEMP"] + "/companion-source",
    "--readelf", os.environ["WEBOS_SDK"] + "/bin/arm-webos-linux-gnueabi-readelf",
    "--rust-sysroot", prepared["rust_sysroot"],
    "--rust-source-archive", prepared["rust_source_archive"],
], env=environment, check=True)
```

Bundle and source output directories must be new/empty as their respective
commands require. Cache entries are reusable only after their checksums match;
a corrupt Rust source cache entry fails explicitly instead of being silently
replaced. The Rust source URL and SHA256 are fixed in the preparation script
and checked against the installed toolchain manifest. The full
compiler commit is pinned in `manifest.json` and checked by preparation, build and
source collection, including when preparation was not invoked first.

Source collection remains incomplete until the enclosing native release binds
the final helper ELF/map/trace and verifies its SDK runtime sources. Do not
delete build outputs before that attestation has completed. Preparation's
`status: ready` means inputs are ready; it is not a build, device test or
complete-source claim.
