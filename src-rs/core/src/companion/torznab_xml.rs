//! Bounded Torznab XML decoding. No DTD, external entities, or response text is executed.
use quick_xml::{events::Event, Reader};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

#[derive(Default)]
struct Node {
    name: String,
    attrs: HashMap<String, String>,
    text: String,
    text_bytes: usize,
    children: Vec<Node>,
    discarded: bool,
}
impl Node {
    fn child(&self, name: &str) -> Option<&Node> {
        self.children.iter().find(|node| node.name == name)
    }
    fn value(&self, name: &str) -> Option<&str> {
        self.attrs.get(name).map(String::as_str)
    }
}
fn document(bytes: &[u8]) -> Result<Node, &'static str> {
    let root = raw_document(bytes, false)?;
    if root.name == "error" {
        return Err("torznab_api_error");
    }
    Ok(root)
}
fn raw_document(bytes: &[u8], discard_indexer_caps: bool) -> Result<Node, &'static str> {
    let text = std::str::from_utf8(bytes).map_err(|_| "torznab_invalid_xml")?;
    let mut reader = Reader::from_str(text);
    let mut stack: Vec<Node> = Vec::new();
    let mut root = None;
    let mut nodes = 0usize;
    let mut retained_nodes = 0usize;
    loop {
        let event = reader.read_event().map_err(|_| "torznab_invalid_xml")?;
        let empty = matches!(&event, Event::Empty(_));
        match event {
            Event::Start(element) | Event::Empty(element) => {
                nodes += 1;
                let scan_limit = if discard_indexer_caps { 262144 } else { 16000 };
                if nodes > scan_limit || stack.len() >= 16 || (stack.is_empty() && root.is_some()) {
                    return Err("torznab_xml_limit");
                }
                let name = String::from_utf8(element.local_name().as_ref().to_vec())
                    .map_err(|_| "torznab_invalid_xml")?;
                // Indexer discovery needs identity and labels, not each child's
                // capability tree. Still parse every event in ignored subtrees:
                // malformed XML, DTDs, entities and depth limits remain errors.
                let discarded = stack.last().is_some_and(|node| node.discarded)
                    || (discard_indexer_caps
                        && stack.len() == 2
                        && stack[0].name == "indexers"
                        && stack[1].name == "indexer"
                        && name == "caps");
                if !discarded {
                    retained_nodes += 1;
                    if retained_nodes > 16000 {
                        return Err("torznab_xml_limit");
                    }
                }
                let mut node = Node {
                    name,
                    discarded,
                    ..Node::default()
                };
                for attr in element.attributes() {
                    let attr = attr.map_err(|_| "torznab_invalid_xml")?;
                    if node.attrs.len() >= 32 {
                        return Err("torznab_xml_limit");
                    }
                    let key = std::str::from_utf8(attr.key.local_name().as_ref())
                        .map_err(|_| "torznab_invalid_xml")?
                        .to_owned();
                    let value = attr
                        .decoded_and_normalized_value(
                            quick_xml::XmlVersion::Implicit1_0,
                            element.decoder(),
                        )
                        .map_err(|_| "torznab_invalid_xml")?
                        .into_owned();
                    if value.len() > 16384 || node.attrs.insert(key, value).is_some() {
                        return Err("torznab_xml_limit");
                    }
                }
                if empty {
                    if node.discarded {
                        continue;
                    } else if let Some(parent) = stack.last_mut() {
                        parent.children.push(node);
                    } else {
                        root = Some(node);
                    }
                } else {
                    stack.push(node);
                }
            }
            Event::End(_) => {
                let node = stack.pop().ok_or("torznab_invalid_xml")?;
                if node.discarded {
                    continue;
                } else if let Some(parent) = stack.last_mut() {
                    parent.children.push(node);
                } else {
                    root = Some(node);
                }
            }
            Event::Text(value) => append(
                &mut stack,
                &value.decode().map_err(|_| "torznab_invalid_xml")?,
            )?,
            Event::CData(value) => append(
                &mut stack,
                &value.decode().map_err(|_| "torznab_invalid_xml")?,
            )?,
            Event::GeneralRef(value) => {
                let value = if let Some(character) = value
                    .resolve_char_ref()
                    .map_err(|_| "torznab_invalid_xml")?
                {
                    character.to_string()
                } else {
                    quick_xml::escape::resolve_predefined_entity(
                        &value.decode().map_err(|_| "torznab_invalid_xml")?,
                    )
                    .ok_or("torznab_invalid_xml")?
                    .to_owned()
                };
                append(&mut stack, &value)?;
            }
            Event::DocType(_) => return Err("torznab_invalid_xml"),
            Event::Eof => {
                if !stack.is_empty() {
                    return Err("torznab_invalid_xml");
                }
                return root.ok_or("torznab_invalid_xml");
            }
            _ => {}
        }
    }
}
fn append(stack: &mut [Node], text: &str) -> Result<(), &'static str> {
    if let Some(node) = stack.last_mut() {
        node.text_bytes += text.len();
        if node.text_bytes > 16384 {
            return Err("torznab_xml_limit");
        }
        if !node.discarded {
            node.text.push_str(text);
        }
    } else if !text.trim().is_empty() {
        return Err("torznab_invalid_xml");
    }
    Ok(())
}
fn number(value: Option<&str>) -> Option<u64> {
    let value = value?.trim();
    if value.is_empty() || !value.bytes().all(|v| v.is_ascii_digit()) {
        return None;
    }
    value.parse().ok().filter(|v| *v <= 9_007_199_254_740_991)
}
fn label(value: &str, maximum: usize) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.len() <= maximum && !value.chars().any(char::is_control))
        .then(|| value.to_owned())
}

pub(super) fn indexer_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && !value.eq_ignore_ascii_case("all")
        && value.as_bytes()[0].is_ascii_alphanumeric()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

#[derive(Clone, Serialize)]
pub(super) struct Indexer {
    pub id: String,
    pub label: String,
    pub language: Option<String>,
    #[serde(rename = "type")]
    pub type_: Option<String>,
}

#[derive(Clone, Serialize)]
pub(super) struct Indexers {
    pub supported: bool,
    pub indexers: Vec<Indexer>,
}

pub(super) fn indexers(bytes: &[u8]) -> Result<Indexers, &'static str> {
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("torznab_xml_limit");
    }
    let root = raw_document(bytes, true)?;
    if root.name == "error" {
        return if root.value("code") == Some("203") {
            Ok(Indexers {
                supported: false,
                indexers: Vec::new(),
            })
        } else {
            Err("torznab_api_error")
        };
    }
    if root.name != "indexers" || !root.text.trim().is_empty() {
        return Err("torznab_invalid_xml");
    }
    let mut entries = Vec::new();
    let mut ids = HashSet::new();
    for node in &root.children {
        if node.name == "error" {
            return Err("torznab_api_error");
        }
        if node.name != "indexer" || !node.text.trim().is_empty() {
            return Err("torznab_invalid_xml");
        }
        if ids.len() >= 256 {
            return Err("torznab_xml_limit");
        }
        let id = node
            .value("id")
            .filter(|id| indexer_id(id))
            .ok_or("torznab_invalid_xml")?;
        if !ids.insert(id) {
            return Err("torznab_invalid_xml");
        }
        // Discovery may include available but unconfigured indexers. They cannot
        // be selected, even if they happen to advertise usable capabilities.
        if node.value("configured") != Some("true") {
            continue;
        }
        entries.push(Indexer {
            id: id.to_owned(),
            label: indexer_text(node, "title", 128)?.ok_or("torznab_invalid_xml")?,
            language: indexer_text(node, "language", 32)?,
            type_: indexer_text(node, "type", 32)?,
        });
    }
    Ok(Indexers {
        supported: true,
        indexers: entries,
    })
}

fn indexer_text(node: &Node, name: &str, maximum: usize) -> Result<Option<String>, &'static str> {
    let mut matches = node.children.iter().filter(|node| node.name == name);
    let Some(value) = matches.next() else {
        return Ok(None);
    };
    if matches.next().is_some() || !value.children.is_empty() {
        return Err("torznab_invalid_xml");
    }
    if value.text.trim().is_empty() {
        return Ok(None);
    }
    label(&value.text, maximum)
        .map(Some)
        .ok_or("torznab_invalid_xml")
}

#[cfg(test)]
#[path = "torznab_xml_children_tests.rs"]
mod children_tests;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Category {
    pub id: u64,
    pub name: String,
    pub parent_id: Option<u64>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Caps {
    pub search_available: bool,
    pub categories: Vec<Category>,
    pub max_limit: usize,
}
pub(super) fn caps(bytes: &[u8]) -> Result<Caps, &'static str> {
    let root = document(bytes)?;
    if root.name != "caps" {
        return Err("torznab_invalid_xml");
    }
    let search_available = root
        .child("searching")
        .and_then(|n| n.child("search"))
        .and_then(|n| n.value("available"))
        .is_some_and(|v| matches!(v, "yes" | "true" | "1"));
    let max_limit = number(root.child("limits").and_then(|n| n.value("max")))
        .unwrap_or(100)
        .clamp(1, 100) as usize;
    let mut categories = Vec::new();
    if let Some(parent) = root.child("categories") {
        for node in &parent.children {
            if node.name != "category" {
                continue;
            }
            let Some(id) = number(node.value("id")).filter(|id| *id > 0) else {
                continue;
            };
            add_category(&mut categories, node, None)?;
            for child in &node.children {
                if child.name == "subcat" {
                    add_category(&mut categories, child, Some(id))?;
                }
            }
        }
    }
    Ok(Caps {
        search_available,
        categories,
        max_limit,
    })
}
fn add_category(
    out: &mut Vec<Category>,
    node: &Node,
    parent_id: Option<u64>,
) -> Result<(), &'static str> {
    let (Some(id), Some(name)) = (
        number(node.value("id")).filter(|id| *id > 0),
        node.value("name").and_then(|v| label(v, 128)),
    ) else {
        return Ok(());
    };
    if out.len() >= 512 {
        return Err("torznab_xml_limit");
    }
    if !out.iter().any(|category| category.id == id) {
        out.push(Category {
            id,
            name,
            parent_id,
        });
    }
    Ok(())
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Item {
    pub result_ref: String,
    pub title: String,
    pub size: Option<u64>,
    pub seeders: Option<u64>,
    pub published_at: Option<String>,
    pub category_ids: Vec<u64>,
    pub languages: Vec<String>,
    #[serde(skip)]
    pub link: String,
}
pub(super) struct Page {
    pub items: Vec<Item>,
    pub total: Option<u64>,
    pub offset: Option<u64>,
    pub count: usize,
}
pub(super) fn page(bytes: &[u8], limit: usize) -> Result<Page, &'static str> {
    let root = document(bytes)?;
    if root.name != "rss" {
        return Err("torznab_invalid_xml");
    }
    let channel = root.child("channel").ok_or("torznab_invalid_xml")?;
    let response = channel.child("response");
    let total = response.and_then(|n| number(n.value("total")));
    let offset = response.and_then(|n| number(n.value("offset")));
    let mut items = Vec::new();
    let mut count = 0;
    for node in &channel.children {
        if node.name != "item" {
            continue;
        }
        count += 1;
        if count > 1000 {
            return Err("torznab_xml_limit");
        }
        if count > limit {
            continue;
        }
        let Some(title) = node.child("title").and_then(|n| label(&n.text, 1024)) else {
            continue;
        };
        let attributes: Vec<_> = node.children.iter().filter(|n| n.name == "attr").collect();
        let attr = |name: &str| {
            attributes
                .iter()
                .find(|n| n.value("name") == Some(name))
                .and_then(|n| n.value("value"))
        };
        let enclosure = node
            .children
            .iter()
            .find(|n| n.name == "enclosure" && n.value("type") == Some("application/x-bittorrent"));
        let link = enclosure
            .and_then(|n| n.value("url"))
            .or_else(|| {
                node.child("link")
                    .map(|n| n.text.trim())
                    .filter(|v| !v.is_empty())
            })
            .or_else(|| attr("magneturl"));
        let Some(link) = link.and_then(|v| label(v, 16384)) else {
            continue;
        };
        let mut category_ids = Vec::new();
        let mut languages = Vec::new();
        for attribute in attributes
            .iter()
            .filter(|n| n.value("name") == Some("category"))
        {
            if let Some(id) = number(attribute.value("value")).filter(|id| *id > 0) {
                if category_ids.len() < 32 && !category_ids.contains(&id) {
                    category_ids.push(id);
                }
            }
        }
        for attribute in attributes
            .iter()
            .filter(|n| matches!(n.value("name"), Some("language" | "languages")))
        {
            for language in attribute.value("value").unwrap_or("").split(',') {
                if let Some(language) = label(language, 32)
                    .filter(|v| v.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-'))
                {
                    if languages.len() < 16 && !languages.contains(&language) {
                        languages.push(language);
                    }
                }
            }
        }
        let published_at = node
            .child("pubDate")
            .and_then(|n| chrono::DateTime::parse_from_rfc2822(n.text.trim()).ok())
            .map(|d| d.to_rfc3339())
            .filter(|s| s.len() <= 64);
        items.push(Item {
            result_ref: String::new(),
            title,
            size: number(attr("size"))
                .or_else(|| number(enclosure.and_then(|n| n.value("length")))),
            seeders: number(attr("seeders")),
            published_at,
            category_ids,
            languages,
            link,
        });
    }
    Ok(Page {
        items,
        total,
        offset,
        count: count.min(limit),
    })
}
