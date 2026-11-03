use super::{caps, indexer_id, indexers, page};
use serde_json::{json, Value};

fn parse(body: &str) -> Result<Value, &'static str> {
    indexers(body.as_bytes()).map(|value| serde_json::to_value(value).unwrap())
}

fn entry(id: &str, title: &str, metadata: &str) -> String {
    format!("<indexer id='{id}' configured='true'><title>{title}</title>{metadata}</indexer>")
}

#[test]
fn configured_indexers_match_canonical_contract() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../tests/fixtures/torrent-indexer-children-v1.json"
    ))
    .unwrap();
    let expected = &fixture["valid"]
        .as_array()
        .unwrap()
        .iter()
        .find(|case| case["name"] == "children-configured")
        .unwrap()["data"];
    let actual = parse(
        "<?xml version='1.0'?><indexers>
          <indexer id='1337x' configured='true'>
            <title>Example indexer</title><language>en-US</language><type>public</type>
            <link>https://private.invalid/?apikey=secret</link>
            <description>not exported</description>
            <caps><searching><search available='yes'/></searching></caps>
          </indexer>
          <indexer id='not-configured' configured='false'><title>Hidden</title></indexer>
          <indexer id='missing-configured'><title>Hidden</title></indexer>
          <indexer id='numeric-configured' configured='1'><title>Hidden</title></indexer>
          <indexer id='Bittorrentfiles' configured='true'><title>Example indexer</title></indexer>
        </indexers>",
    )
    .unwrap();
    assert_eq!(actual["supported"], expected["supported"]);
    assert_eq!(actual["indexers"], expected["indexers"]);
    assert_eq!(actual.as_object().unwrap().len(), 2);
}

#[test]
fn empty_and_unconfigured_lists_are_supported() {
    let expected = json!({"supported": true, "indexers": []});
    assert_eq!(parse("<indexers/>"), Ok(expected.clone()));
    assert_eq!(
        parse("<indexers><indexer id='hidden' configured='false'/></indexers>"),
        Ok(expected)
    );
}

#[test]
fn ids_are_exact_case_ascii_and_bounded() {
    for id in ["a", "0", "1337x", "Bittorrentfiles", "a_1-Z", "all2"] {
        assert!(indexer_id(id), "{id}");
    }
    assert!(indexer_id(&"A".repeat(128)));
    for id in [
        "", "all", "ALL", "aLl", "_a", "-a", "a.b", "a/b", "a%2fb", "a?b", "a#b", "a:b", " a",
        "a ", "a\n", "é", "aé", "全", "a\\b",
    ] {
        assert!(!indexer_id(id), "{id:?}");
    }
    assert!(!indexer_id(&"a".repeat(129)));
    let actual = parse(&format!(
        "<indexers>{}{}</indexers>",
        entry("Child", "First", ""),
        entry("child", "Second", "")
    ))
    .unwrap();
    assert_eq!(actual["indexers"][0]["id"], "Child");
    assert_eq!(actual["indexers"][1]["id"], "child");
}

#[test]
fn canonical_invalid_selector_ids_are_rejected() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../tests/fixtures/torrent-indexer-children-v1.json"
    ))
    .unwrap();
    let mut checked = 0;
    for case in fixture["invalid_requests"].as_array().unwrap() {
        if case["name"].as_str().unwrap().starts_with("bad-child-id-") {
            assert!(!indexer_id(case["params"]["indexerId"].as_str().unwrap()));
            checked += 1;
        }
    }
    assert_eq!(checked, 9);
}

#[test]
fn invalid_and_duplicate_ids_fail_entire_response() {
    for body in [
        "<indexers><indexer configured='true'><title>A</title></indexer></indexers>".into(),
        format!("<indexers>{}</indexers>", entry("ALL", "A", "")),
        format!("<indexers>{}</indexers>", entry("é", "A", "")),
        format!("<indexers>{}</indexers>", entry("a/b", "A", "")),
        format!(
            "<indexers>{}{}</indexers>",
            entry("same", "First", ""),
            entry("same", "Second", "")
        ),
        format!(
            "<indexers><indexer id='same' configured='false'/>{}</indexers>",
            entry("same", "Second", "")
        ),
    ] {
        assert_eq!(parse(&body), Err("torznab_invalid_xml"));
    }
}

#[test]
fn enumeration_is_limited_to_256_entries_without_truncation() {
    let entries = (0..256)
        .map(|i| entry(&format!("child-{i}"), "Title", ""))
        .collect::<String>();
    let actual = parse(&format!("<indexers>{entries}</indexers>")).unwrap();
    assert_eq!(actual["indexers"].as_array().unwrap().len(), 256);
    assert_eq!(
        parse(&format!(
            "<indexers>{entries}{}</indexers>",
            entry("overflow", "Title", "")
        )),
        Err("torznab_xml_limit")
    );
    let unconfigured = (0..257)
        .map(|i| format!("<indexer id='child-{i}' configured='false'/>"))
        .collect::<String>();
    assert_eq!(
        parse(&format!("<indexers>{unconfigured}</indexers>")),
        Err("torznab_xml_limit")
    );
}

#[test]
fn all_256_children_may_have_full_capability_trees() {
    let categories = (0..63)
        .map(|i| format!("<category id='{i}' name='Category {i}'/>"))
        .collect::<String>();
    let capabilities = format!("<caps><categories>{categories}</categories></caps>");
    let entries = (0..256)
        .map(|i| entry(&format!("child-{i}"), "Title", &capabilities))
        .collect::<String>();
    let xml = format!("<indexers>{entries}</indexers>");
    assert!(xml.len() < 2 * 1024 * 1024);
    let actual = parse(&xml).unwrap();
    assert_eq!(actual["indexers"].as_array().unwrap().len(), 256);
    assert_eq!(actual["indexers"][255]["id"], "child-255");
    assert_eq!(actual["indexers"][255].as_object().unwrap().len(), 4);
}

#[test]
fn discarded_caps_still_require_well_formed_bounded_xml() {
    for capabilities in [
        "<caps><categories><category></categories></caps>".to_owned(),
        "<caps><category id='1' id='2'/></caps>".into(),
        "<caps>&missing;</caps>".into(),
        "<caps><category name='&missing;'/></caps>".into(),
        "<caps><![DOCTYPE caps]></caps>".into(),
        "<caps><!DOCTYPE caps [<!ENTITY x SYSTEM 'file:///secret'>]></caps>".into(),
        format!(
            "<caps>{}{}</caps>",
            "<nested>".repeat(16),
            "</nested>".repeat(16)
        ),
        format!("<caps>{}</caps>", "x".repeat(16385)),
    ] {
        let xml = format!(
            "<indexers>{}</indexers>",
            entry("child", "Title", &capabilities)
        );
        assert!(parse(&xml).is_err(), "{capabilities}");
    }
}

#[test]
fn discarded_caps_have_a_scan_limit_and_do_not_relax_other_tree_limits() {
    let xml = format!(
        "<indexers>{}</indexers>",
        entry(
            "child",
            "Title",
            &format!("<caps>{}</caps>", "<x/>".repeat(262144))
        )
    );
    assert!(xml.len() < 2 * 1024 * 1024);
    assert_eq!(parse(&xml), Err("torznab_xml_limit"));
    let many_nodes = "<x/>".repeat(16000);
    assert_eq!(
        parse(&format!(
            "<indexers>{}</indexers>",
            entry("child", "Title", &many_nodes)
        )),
        Err("torznab_xml_limit")
    );
    assert!(matches!(
        caps(format!("<caps>{many_nodes}</caps>").as_bytes()),
        Err("torznab_xml_limit")
    ));
}

#[test]
fn labels_and_metadata_are_utf8_bounded() {
    let title = "é".repeat(64);
    let metadata = "é".repeat(16);
    let actual = parse(&format!(
        "<indexers>{}</indexers>",
        entry(
            "child",
            &title,
            &format!("<language>{metadata}</language><type>{metadata}</type>")
        )
    ))
    .unwrap();
    assert_eq!(actual["indexers"][0]["label"], title);
    for (title, metadata) in [
        ("é".repeat(65), String::new()),
        (
            "Title".into(),
            format!("<language>{}</language>", "é".repeat(17)),
        ),
        ("Title".into(), format!("<type>{}</type>", "x".repeat(33))),
        ("First\nSecond".into(), String::new()),
        ("Title".into(), "<language>en\nUS</language>".into()),
        ("Title".into(), "<type>pub\tlic</type>".into()),
    ] {
        assert_eq!(
            parse(&format!(
                "<indexers>{}</indexers>",
                entry("child", &title, &metadata)
            )),
            Err("torznab_invalid_xml")
        );
    }
}

#[test]
fn optional_empty_metadata_is_explicit_null() {
    let actual = parse(&format!(
        "<indexers>{}</indexers>",
        entry("child", " A &amp; B ", "<language> </language><type/>")
    ))
    .unwrap();
    assert_eq!(
        actual["indexers"][0],
        json!({"id": "child", "label": "A & B", "language": null, "type": null})
    );
}

#[test]
fn required_title_and_ambiguous_metadata_fail() {
    for body in [
        "<indexer id='child' configured='true'/>",
        "<indexer id='child' configured='true'><title> </title></indexer>",
        "<indexer id='child' configured='true'><title>A</title><title>B</title></indexer>",
        "<indexer id='child' configured='true'><title>A<b>B</b></title></indexer>",
        "<indexer id='child' configured='true'><title>A</title><language>en</language><language>ru</language></indexer>",
        "<indexer id='child' configured='true'><title>A</title><type><b>private</b></type></indexer>",
    ] {
        assert_eq!(parse(&format!("<indexers>{body}</indexers>")), Err("torznab_invalid_xml"));
    }
}

#[test]
fn only_explicit_203_means_unsupported() {
    assert_eq!(
        parse("<error code='203' description='Function not available'/>"),
        Ok(json!({"supported": false, "indexers": []}))
    );
    for code in [
        "", "100", "101", "102", "200", "201", "202", "204", "500", " 203", "0203",
    ] {
        assert_eq!(
            parse(&format!("<error code='{code}' description='not echoed'/>")),
            Err("torznab_api_error")
        );
    }
    assert_eq!(parse("<error/>"), Err("torznab_api_error"));
    assert_eq!(
        parse("<indexers><error code='203'/></indexers>"),
        Err("torznab_api_error")
    );
}

#[test]
fn malformed_documents_do_not_become_unsupported_or_empty() {
    for xml in [
        "",
        "<caps/>",
        "<rss><channel/></rss>",
        "<html>Forbidden</html>",
        "<indexers>",
        "<indexers><indexer></indexers>",
        "<indexers/><indexers/>",
        "<!DOCTYPE indexers [<!ENTITY x SYSTEM 'file:///secret'>]><indexers/>",
        "<indexers>&missing;</indexers>",
        "<indexers>unexpected</indexers>",
        "<indexers><unknown/></indexers>",
        "<indexers><indexer id='child' id='other' configured='true'/></indexers>",
    ] {
        assert!(parse(xml).is_err(), "{xml}");
    }
    assert!(indexers(&[0xff]).is_err());
}

#[test]
fn raw_response_size_is_bounded_before_xml_parsing() {
    assert_eq!(
        parse(&" ".repeat(2 * 1024 * 1024 + 1)),
        Err("torznab_xml_limit")
    );
}

#[test]
fn existing_caps_and_page_keep_api_error_semantics() {
    for xml in [
        b"<error code='203'/>".as_slice(),
        b"<error code='100'/>".as_slice(),
    ] {
        assert!(matches!(caps(xml), Err("torznab_api_error")));
        assert!(matches!(page(xml, 10), Err("torznab_api_error")));
    }
    let parsed = caps(b"<caps><limits max='25'/><searching><search available='yes'/></searching><categories><category id='2000' name='Movies'/></categories></caps>").unwrap();
    assert!(parsed.search_available);
    assert_eq!(parsed.max_limit, 25);
    assert_eq!(parsed.categories[0].name, "Movies");
    let parsed = page(b"<rss><channel><item><title>A &amp; B</title><link>magnet:?xt=urn:btih:example</link></item></channel></rss>", 10).unwrap();
    assert_eq!(parsed.items.len(), 1);
    assert_eq!(parsed.items[0].title, "A & B");
    assert_eq!(parsed.items[0].link, "magnet:?xt=urn:btih:example");
}
