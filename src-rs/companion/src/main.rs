//! A caller-owned, loopback-only media companion. No player or public routes.
#[cfg(any(
    all(
        feature = "webos-legacy-glibc",
        target_arch = "arm",
        target_os = "linux"
    ),
    test
))]
mod legacy_auxv;

use anyhow::Context;
use ottplay_core::companion::ResourceLimits;
use std::{ffi::OsString, net::SocketAddr, path::PathBuf};
use tokio::net::TcpListener;

const DEFAULT_PORT: u16 = 8793;

struct Configuration {
    directory: PathBuf,
    token: String,
    plugins: Option<PathBuf>,
    port: u16,
    limits: ResourceLimits,
}

fn absolute_directory(value: Option<OsString>, name: &str) -> anyhow::Result<PathBuf> {
    let path = PathBuf::from(value.with_context(|| format!("{name} is required"))?);
    anyhow::ensure!(path.is_absolute(), "{name} must be absolute");
    Ok(path)
}

fn optional_env(name: &str) -> anyhow::Result<Option<String>> {
    match std::env::var(name) {
        Ok(value) => Ok(Some(value)),
        Err(std::env::VarError::NotPresent) => Ok(None),
        Err(_) => anyhow::bail!("{name} must contain valid Unicode"),
    }
}

fn local_settings(
    host: Option<&str>,
    remote: Option<&str>,
    port: Option<&str>,
) -> anyhow::Result<u16> {
    anyhow::ensure!(
        host.is_none_or(|value| value == "127.0.0.1"),
        "Standalone companion binds only to 127.0.0.1"
    );
    anyhow::ensure!(
        remote.is_none_or(|value| value == "0"),
        "Standalone companion does not support remote access"
    );
    port.map(str::parse::<u16>)
        .transpose()
        .context("OTT_COMPANION_PORT must be a port from 0 to 65535")
        .map(|value| value.unwrap_or(DEFAULT_PORT))
}

fn resource_limits(
    cache: Option<&str>,
    sessions: Option<&str>,
    streams: Option<&str>,
) -> anyhow::Result<ResourceLimits> {
    let defaults = ResourceLimits::default();
    ResourceLimits {
        cache_bytes: cache
            .map(str::parse)
            .transpose()
            .context("Invalid OTT_COMPANION_CACHE_BYTES")?
            .unwrap_or(defaults.cache_bytes),
        max_sessions: sessions
            .map(str::parse)
            .transpose()
            .context("Invalid OTT_COMPANION_MAX_SESSIONS")?
            .unwrap_or(defaults.max_sessions),
        max_streams: streams
            .map(str::parse)
            .transpose()
            .context("Invalid OTT_COMPANION_MAX_STREAMS")?
            .unwrap_or(defaults.max_streams),
    }
    .validate()
}

impl Configuration {
    fn from_env() -> anyhow::Result<Self> {
        let port = local_settings(
            optional_env("OTT_COMPANION_HOST")?.as_deref(),
            optional_env("OTT_COMPANION_ALLOW_REMOTE")?.as_deref(),
            optional_env("OTT_COMPANION_PORT")?.as_deref(),
        )?;
        let directory =
            absolute_directory(std::env::var_os("OTT_COMPANION_DIR"), "OTT_COMPANION_DIR")?;
        let token =
            optional_env("OTT_COMPANION_TOKEN")?.context("OTT_COMPANION_TOKEN is required")?;
        let plugins = std::env::var_os("OTT_COMPANION_PLUGIN_DIR")
            .map(|value| absolute_directory(Some(value), "OTT_COMPANION_PLUGIN_DIR"))
            .transpose()?;
        let limits = resource_limits(
            optional_env("OTT_COMPANION_CACHE_BYTES")?.as_deref(),
            optional_env("OTT_COMPANION_MAX_SESSIONS")?.as_deref(),
            optional_env("OTT_COMPANION_MAX_STREAMS")?.as_deref(),
        )?;
        Ok(Self {
            directory,
            token,
            plugins,
            port,
            limits,
        })
    }
}

async fn shutdown_signal() -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .context("Cannot register termination signal")?;
        tokio::select! {
            result = tokio::signal::ctrl_c() => result.context("Cannot receive interrupt signal"),
            _ = terminate.recv() => Ok(()),
        }
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c()
        .await
        .context("Cannot receive interrupt signal")
}

async fn serve(configuration: Configuration) -> anyhow::Result<()> {
    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], configuration.port)))
        .await
        .context("Cannot bind companion loopback listener")?;
    let service = ottplay_core::companion::Companion::with_limits(
        configuration.directory,
        configuration.token,
        configuration.plugins,
        configuration.limits,
    )
    .await?;
    // This is only the listen address. A capability URL contains a secret and
    // must never be emitted to an ordinary log or process output stream.
    eprintln!("ottplay-companion: http://{}", listener.local_addr()?);
    let result = tokio::select! {
        result = axum::serve(listener, service.routes()) => result.context("Companion listener failed"),
        result = shutdown_signal() => result,
    };
    service.shutdown().await;
    result
}

#[tokio::main(worker_threads = 2)]
async fn main() -> anyhow::Result<()> {
    if let Some(argument) = std::env::args_os().nth(1) {
        if argument == "--help" || argument == "-h" {
            println!("Usage: ottplay-companion\n\nRequired environment: OTT_COMPANION_DIR (absolute), OTT_COMPANION_TOKEN\nOptional: OTT_COMPANION_PORT (default 8793; 0 selects a free port), OTT_COMPANION_PLUGIN_DIR\nResource limits (optional):\n  OTT_COMPANION_CACHE_BYTES: 67108864..=2147483648 bytes (64 MiB..=2 GiB; default 2147483648)\n  OTT_COMPANION_MAX_SESSIONS: 1..=2 (default 2)\n  OTT_COMPANION_MAX_STREAMS: 1..=4 (default 4)\nBinds only to 127.0.0.1. The caller owns process startup and termination.");
            return Ok(());
        }
        anyhow::bail!("Unexpected argument; use --help for configuration");
    }
    serve(Configuration::from_env()?).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_listener_cannot_be_configured_for_remote_access() {
        assert_eq!(local_settings(None, None, None).unwrap(), DEFAULT_PORT);
        assert_eq!(
            local_settings(Some("127.0.0.1"), Some("0"), Some("0")).unwrap(),
            0
        );
        for host in ["0.0.0.0", "192.168.1.2", "::", "::1", "localhost"] {
            assert!(local_settings(Some(host), None, None).is_err());
            assert!(local_settings(Some(host), Some("1"), None).is_err());
        }
        for remote in ["1", "true", ""] {
            assert!(local_settings(None, Some(remote), None).is_err());
        }
        for port in ["65536", "-1", "", "not-a-port"] {
            assert!(local_settings(None, None, Some(port)).is_err());
        }
    }

    #[test]
    fn storage_must_be_explicit_and_absolute() {
        assert!(absolute_directory(None, "OTT_COMPANION_DIR").is_err());
        assert!(absolute_directory(Some("relative".into()), "OTT_COMPANION_DIR").is_err());
        assert!(absolute_directory(
            Some(std::env::temp_dir().into_os_string()),
            "OTT_COMPANION_DIR"
        )
        .is_ok());
    }

    #[test]
    fn constrained_limits_are_explicit_and_bounded() {
        let defaults = resource_limits(None, None, None).unwrap();
        assert_eq!(defaults.cache_bytes, 2 * 1024 * 1024 * 1024);
        assert_eq!(defaults.max_sessions, 2);
        let tv = resource_limits(Some("268435456"), Some("1"), Some("2")).unwrap();
        assert_eq!(tv.cache_bytes, 256 * 1024 * 1024);
        assert_eq!(tv.max_sessions, 1);
        assert_eq!(tv.max_streams, 2);
        for cache in ["", "-1", "0", "67108863", "2147483649", "NaN"] {
            assert!(resource_limits(Some(cache), None, None).is_err());
        }
        for sessions in ["0", "3", "-1", ""] {
            assert!(resource_limits(None, Some(sessions), None).is_err());
        }
        for streams in ["0", "5", "-1", ""] {
            assert!(resource_limits(None, None, Some(streams)).is_err());
        }
    }
}
