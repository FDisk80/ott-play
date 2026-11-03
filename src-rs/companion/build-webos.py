#!/usr/bin/env python3
"""Cross-build the loopback companion with an explicitly supplied webOS SDK."""
import argparse
import os
import shlex
import subprocess
import tempfile
from pathlib import Path

import webos_link


def path_remaps(root, output, cargo_home, rust_sysroot, sdk, home, temporary):
    """Map compile-time paths without altering the real linker input evidence."""
    mappings = {}
    for path, replacement in ((home, "/build/user"), (temporary, "/build/tmp"),
                              (cargo_home, "/build/cargo"), (rust_sysroot, "/build/rust"),
                              (sdk, "/build/webos-sdk"), (output, "/build/ottplay-target"),
                              (root, "/build/ottplay-companion")):
        path = Path(path).expanduser().absolute()
        # Both spellings can reach compilers on hosts with symlinked /var or
        # workspaces. Never remap '/', which would hide unrelated path inputs.
        for spelling in (path, path.resolve()):
            if spelling == Path("/") or any(char in str(spelling) for char in "\x00\n\r="):
                raise ValueError("Unsafe compiler path prefix")
            mappings[str(spelling)] = replacement
    # Rust and GCC apply the last matching prefix. Put specific roots after
    # broad home/temp roots so repository and dependency locations stay stable.
    return sorted(mappings.items(), key=lambda item: (len(item[0]), item[0]))


def compilation_flags(sysroot, remaps):
    rust = [
        "-C", "target-cpu=cortex-a9", "-C", "target-feature=-neon,-soft-float",
        "-C", "force-frame-pointers=yes", "-C", "link-arg=--sysroot=" + str(sysroot),
    ]
    native = ["--sysroot=" + str(sysroot)]
    for original, replacement in remaps:
        mapping = original + "=" + replacement
        rust.extend(("--remap-path-prefix", mapping))
        # file-prefix-map covers __FILE__/__BASE_FILE__ and debug paths. Keep
        # macro-prefix-map explicit for C/C++ build systems using macro strings.
        native.extend(("-ffile-prefix-map=" + mapping, "-fmacro-prefix-map=" + mapping))
    # Bindgen parses headers with libclang, not the SDK GCC. It does not emit
    # native source-location strings and must not inherit GCC-specific flags.
    bindgen = ["--sysroot=" + str(sysroot)]
    return rust, native, bindgen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", type=Path, required=True)
    parser.add_argument("--libclang", type=Path)
    parser.add_argument("--target-dir", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    sdk = args.sdk.resolve(strict=True)
    sysroot = (sdk / "arm-webos-linux-gnueabi/sysroot").resolve(strict=True)
    output = (args.target_dir or root / "target").resolve()
    target = "armv7-unknown-linux-gnueabi"
    key = target.replace("-", "_")
    environment = os.environ.copy()
    for name, tool in (("CC", "gcc"), ("CXX", "g++"), ("AR", "ar")):
        executable = sdk / ("bin/arm-webos-linux-gnueabi-" + tool)
        if not executable.is_file():
            parser.error("SDK compiler or archiver is missing")
        environment[name + "_" + key] = str(executable)
    environment["CARGO_TARGET_DIR"] = str(output)
    environment["OTT_COMPANION_CC"] = environment["CC_" + key]
    environment["OTT_COMPANION_BUILD_ROOT"] = str(root)
    environment["OTT_COMPANION_BUILD_TARGET"] = str(output)
    rust_sysroot = Path(subprocess.check_output(
        ["rustc", "--print", "sysroot"], env=environment, text=True).strip()).resolve(strict=True)
    environment["OTT_COMPANION_RUST_SYSROOT"] = str(rust_sysroot)
    environment["CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABI_LINKER"] = str(Path(__file__).with_name("webos_link.py"))
    remaps = path_remaps(root, output, environment.get("CARGO_HOME", Path.home() / ".cargo"),
                        rust_sysroot, sdk, Path.home(), tempfile.gettempdir())
    flags, native_flags, bindgen_flags = compilation_flags(sysroot, remaps)
    environment["CFLAGS_" + key] = shlex.join(native_flags)
    environment["CXXFLAGS_" + key] = environment["CFLAGS_" + key]
    environment["BINDGEN_EXTRA_CLANG_ARGS_" + key] = shlex.join(bindgen_flags)
    if args.libclang:
        libclang = args.libclang.expanduser().absolute()
        if not (libclang.is_file() or libclang.is_dir()):
            parser.error("Host libclang path is missing or unsupported")
        environment["LIBCLANG_PATH"] = str(libclang)
    binary = output / target / "release/ottplay-companion"
    # Encoded flags preserve SDK and output paths containing spaces and override
    # ambient Rust flags for this explicit target build. Host builds are separate.
    environment["CARGO_ENCODED_RUSTFLAGS"] = "\x1f".join(flags)
    subprocess.run([
        "cargo", "build", "--locked", "--release", "-p", "ottplay-companion",
        "--features", "webos-legacy-glibc", "--target", target,
    ], cwd=root, env=environment, check=True)
    webos_link.check_embedded_paths(binary)
    # Cargo copies the final ELF out of its internal hash-named output. Match
    # the wrapper's real link receipt by bytes, never by a guessed filename.
    webos_link.stage_evidence(binary, compiler=Path(environment["OTT_COMPANION_CC"]))
    evidence = subprocess.run([
        str(sdk / "bin/arm-webos-linux-gnueabi-readelf"), "--wide", "--file-header",
        "--program-headers", "--dynamic", "--version-info", str(binary),
    ], check=True, capture_output=True, text=True).stdout
    binary.with_suffix(".elf.txt").write_text(evidence)
    print(binary)
    print(evidence)


if __name__ == "__main__":
    main()
