//! Passive comparison against the existing instance endpoint. No library initialization or I/O.
use super::offline_media::OfflineMediaState;
use serde::Serialize;

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Source {
    kind: &'static str,
    endpoint_match: &'static str,
    item_id: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
    version: u8,
    current_source: Source,
    requested_source: Source,
}
fn id(value: &str) -> bool {
    value.len() == 32
        && value
            .bytes()
            .all(|v| v.is_ascii_digit() || (b'a'..=b'f').contains(&v))
}
fn classify(raw: Option<&str>, endpoint: Option<&str>) -> Source {
    let mut out = Source {
        kind: "unavailable",
        endpoint_match: "unknown",
        item_id: None,
    };
    let Some(raw) = raw else { return out };
    if raw.len() > 8192 {
        return out;
    }
    out.endpoint_match = "not_applicable";
    out.kind = if raw.is_empty() {
        "empty"
    } else if raw.starts_with("blob:") {
        "blob"
    } else {
        "other"
    };
    if raw.is_empty()
        || raw.starts_with("blob:")
        || raw.chars().any(char::is_control)
        || raw.contains(['%', '?', '#', '\\'])
    {
        return out;
    }
    let Ok(url) = url::Url::parse(raw) else {
        return out;
    };
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || !matches!(
            url.host_str(),
            Some("127.0.0.1" | "localhost" | "[::1]" | "::1")
        )
    {
        return out;
    }
    let parts: Vec<_> = url.path().split('/').collect();
    if parts.len() < 4
        || parts[0] != ""
        || parts[1] != "offline-media"
        || !(32..=256).contains(&parts[2].len())
        || !parts[2]
            .bytes()
            .all(|v| v.is_ascii_alphanumeric() || matches!(v, b'_' | b'-'))
    {
        return out;
    }
    let item = if parts.len() == 4 && id(parts[3]) {
        out.kind = "direct";
        parts[3]
    } else if parts.len() == 7
        && parts[3] == "compat"
        && id(parts[4])
        && id(parts[5])
        && matches!(parts[6], "index.m3u8" | "video.m3u8")
    {
        out.kind = "compatibility";
        parts[4]
    } else {
        return out;
    };
    out.endpoint_match = match endpoint.and_then(|value| url::Url::parse(value).ok()) {
        None => "unknown",
        Some(active) => {
            if url.origin() == active.origin()
                && active.path() == format!("/offline-media/{}", parts[2])
            {
                "match"
            } else {
                "mismatch"
            }
        }
    };
    if out.endpoint_match == "match" {
        out.item_id = Some(item.to_owned());
    }
    out
}

#[tauri::command]
pub fn local_source_diagnostics(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, OfflineMediaState>,
    current_source: Option<String>,
    requested_source: Option<String>,
) -> Result<Observation, &'static str> {
    if window.label() != "main" {
        return Err("Local source diagnostics require the main window");
    }
    let endpoint = state.diagnostic_endpoint();
    Ok(Observation {
        version: 1,
        current_source: classify(current_source.as_deref(), endpoint.as_deref()),
        requested_source: classify(requested_source.as_deref(), endpoint.as_deref()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn endpoint() -> String {
        format!("http://127.0.0.1:34567/offline-media/{}", "a".repeat(64))
    }
    #[test]
    fn current_and_assigned_are_independent_and_routes_are_exact() {
        let endpoint = endpoint();
        let direct = format!("{endpoint}/{}", "b".repeat(32));
        assert_eq!(classify(Some(""), Some(&endpoint)).kind, "empty");
        assert_eq!(
            classify(Some(&direct), Some(&endpoint)).endpoint_match,
            "match"
        );
        for value in [
            direct.replace("34567", "34568"),
            direct.replace(&"a".repeat(64), &"c".repeat(64)),
        ] {
            let result = classify(Some(&value), Some(&endpoint));
            assert_eq!(result.endpoint_match, "mismatch");
            assert!(result.item_id.is_none());
        }
        assert_eq!(classify(Some(&direct), None).endpoint_match, "unknown");
        let compat = format!(
            "{endpoint}/compat/{}/{}/index.m3u8",
            "b".repeat(32),
            "c".repeat(32)
        );
        assert_eq!(
            classify(Some(&compat), Some(&endpoint)).kind,
            "compatibility"
        );
        for value in [
            format!("{direct}?token=x"),
            format!("{direct}#x"),
            format!("{direct}/extra"),
            direct.replace("offline-media", "offline-media-other"),
            direct.replace("127.0.0.1", "remote.invalid"),
            direct.replace("http://", "http://user@"),
            format!("{endpoint}/%2e%2e/{}", "b".repeat(32)),
        ] {
            let result = classify(Some(&value), Some(&endpoint));
            assert_eq!(result.kind, "other");
            assert!(result.item_id.is_none());
        }
        for (value, kind) in [
            ("blob:http://127.0.0.1/private", "blob"),
            ("file:///private/movie.mp4", "other"),
            ("data:video/mp4,x", "other"),
        ] {
            let result = classify(Some(value), Some(&endpoint));
            assert_eq!(result.kind, kind);
            assert_eq!(result.endpoint_match, "not_applicable");
        }
    }
    #[test]
    fn missing_or_busy_runtime_does_not_initialize() {
        let state = OfflineMediaState::default();
        assert!(state.diagnostic_endpoint().is_none());
        let _guard = state.diagnostic_lock_for_test();
        assert!(state.diagnostic_endpoint().is_none());
    }
}
