fn main() {
    println!("cargo:rerun-if-env-changed=OTTPLAY_GST_COMPAT_MANIFEST_SHA256");
    println!("cargo:rerun-if-env-changed=RELEASE_CHANNEL");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux")
        && std::env::var_os("RELEASE_CHANNEL").is_some()
    {
        let digest = std::env::var("OTTPLAY_GST_COMPAT_MANIFEST_SHA256")
            .expect("Linux release requires the private playback manifest binding");
        assert!(
            digest.len() == 64
                && digest
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase()),
            "Invalid private playback manifest SHA-256"
        );
    }
    // Build scripts run on the host; select linker flags from the target.
    let windows_msvc = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");
    let attributes = if windows_msvc {
        // tauri-winres links its resource only into bins, not lib tests/examples.
        // Avoid duplicate manifests while retaining its icon/version resource.
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest())
    } else {
        tauri_build::Attributes::new()
    };
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
    if windows_msvc {
        let manifest = std::path::PathBuf::from(
            std::env::var_os("CARGO_MANIFEST_DIR").expect("missing Cargo manifest directory"),
        )
        .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        // Apply the unchanged Tauri default to binaries, tests and examples.
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
        // Do not add the linker's default UAC fragment to the upstream XML.
        println!("cargo:rustc-link-arg=/MANIFESTUAC:NO");
        println!("cargo:rustc-link-arg=/WX");
    }
}
