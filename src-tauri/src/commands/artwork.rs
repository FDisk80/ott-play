//! Binary artwork bridge; the generic HTTP commands intentionally remain text-only.
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkResult {
    content_type: &'static str,
    body_base64: String,
}

/// `invoke('artwork_fetch', { url })`; rejects on standby, invalid input or fetch failure.
#[tauri::command]
pub async fn artwork_fetch(
    background: tauri::State<'_, ottplay_core::background_work::BackgroundWork>,
    url: String,
) -> Result<ArtworkResult, String> {
    let work = background.enter().map_err(str::to_string)?;
    work.run(async {
        let image = ottplay_core::artwork::fetch_tracked(
            ottplay_core::artwork::Request { url },
            work.clone(),
        )
        .await?;
        Ok(ArtworkResult {
            content_type: image.content_type,
            body_base64: super::tmdb::b64_encode(&image.bytes),
        })
    })
    .await
    .map_err(str::to_string)?
}

#[cfg(test)]
mod tests {
    #[test]
    fn artwork_ipc_preserves_binary_bytes_and_camel_case_contract() {
        let result = super::ArtworkResult {
            content_type: "image/jpeg",
            body_base64: super::super::tmdb::b64_encode(b"\xff\xd8\xff\x00"),
        };
        assert_eq!(
            serde_json::to_value(result).unwrap(),
            serde_json::json!({
                "contentType": "image/jpeg", "bodyBase64": "/9j/AA=="
            })
        );
    }
}
