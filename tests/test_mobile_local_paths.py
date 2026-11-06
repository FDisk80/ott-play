"""Run actual mobile tree producers with small platform doubles, without app builds."""
from pathlib import Path
import argparse
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def function(source, marker):
    start = source.index(marker)
    end = source.index("{", start) + 1
    depth = 1
    while depth:
        depth += (source[end] == "{") - (source[end] == "}")
        end += 1
    return source[start:end]


class MobileLocalPaths(unittest.TestCase):
    def test_android_actual_tree_and_metadata_upgrade(self):
        source = (ROOT / "android/app/src/main/java/play/ott/foss/LocalMediaPlugin.kt").read_text()
        methods = "\n".join(function(source, marker) for marker in (
            "private fun relativeChildPath(", "private fun link(", "private fun scanTree(",
        ))
        # JSONObject is a map/clone double; real scan/link code still performs
        # the metadata-file publication. No path logic lives in the doubles.
        code = r'''
import java.io.File
import java.io.IOException
import java.util.UUID
import java.nio.file.Files
class JSONObject() {
    private val values = mutableMapOf<String, Any>()
    constructor(raw: String): this() { values.putAll(snapshots.getValue(raw)) }
    fun put(key: String, value: Any): JSONObject { values[key] = value; return this }
    fun has(key: String) = values.containsKey(key)
    fun opt(key: String): Any? = values[key]
    fun optString(key: String) = values[key] as? String ?: ""
    fun getString(key: String) = values[key] as String
    override fun toString(): String {
        val key = "snapshot-${snapshots.size}"
        snapshots[key] = values.toMap(); return key
    }
    companion object { val NULL = Any(); val snapshots = mutableMapOf<String, Map<String, Any>>() }
}
data class Uri(val tree: String, val document: String = "root", val kind: String = "tree") {
    override fun toString() = "$kind:$tree:$document"
}
object DocumentsContract {
    object Document {
        const val COLUMN_DOCUMENT_ID = "id"
        const val COLUMN_DISPLAY_NAME = "name"
        const val COLUMN_MIME_TYPE = "mime"
        const val MIME_TYPE_DIR = "directory"
    }
    fun getTreeDocumentId(tree: Uri) = tree.document
    fun buildDocumentUriUsingTree(tree: Uri, id: String) = Uri(tree.tree, id, "document")
    fun buildChildDocumentsUriUsingTree(tree: Uri, id: String) = Uri(tree.tree, id, "children")
}
object OpenableColumns { const val DISPLAY_NAME = "name" }
object LocalMediaRange { fun mime(name: String) = "video/mp4" }
class Cursor(val rows: List<List<String>>): AutoCloseable {
    private var index = -1
    fun moveToFirst(): Boolean { index = 0; return rows.isNotEmpty() }
    fun moveToNext(): Boolean { index++; return index < rows.size }
    fun getString(column: Int) = rows[index][column]
    override fun close() {}
}
class Media: AutoCloseable { val size = 42L; override fun close() {} }
class Work { fun commit(action: () -> Unit) = action() }
class Resolver { fun getType(uri: Uri) = "video/mp4" }
class Context { val contentResolver = Resolver() }
class Harness(val directory: File) {
    val context = Context()
    val currentWork = ThreadLocal<Work>()
    val destroyed = false
    var metadataReads = 0
    val documents = mapOf(
        "root" to listOf(listOf("root-clip", "Clip.mp4", "video/mp4"), listOf("season", "Season 1", "directory"),
            listOf("unicode", "Кино %20", "directory"), listOf("bad", "bad/name", "directory")),
        "season" to listOf(listOf("nested-clip", "Clip.mp4", "video/mp4")),
        "unicode" to listOf(listOf("unicode-clip", "Фильм.mp4", "video/mp4")),
        "bad" to listOf(listOf("bad-clip", "Clip.mp4", "video/mp4"))
    )
    fun checkWork() {}
    fun query(uri: Uri, columns: Array<String>): Cursor? = Cursor(
        if (uri.kind == "children") documents[uri.document].orEmpty() else listOf(listOf("Movies")))
    fun saveSource(uri: Uri, name: String, kind: String) {}
    fun sourceId(uri: Uri) = "source-${uri}"
    fun openSource(item: JSONObject) = Media()
    fun metadata(): List<JSONObject> {
        metadataReads++
        return directory.listFiles().orEmpty().filter { it.extension == "json" }.map { JSONObject(it.readText()) }
    }
    private class UnavailableDocument(cause: Exception): IOException(cause)
''' + methods + r'''
    fun run() {
        val tree = Uri("selected")
        val individualBeforeFolder = Uri("selected", "root-clip", "document")
        val independent = JSONObject().put("id", "individual-before-folder")
            .put("uri", individualBeforeFolder.toString()).put("grantUri", individualBeforeFolder.toString())
            .put("sourceId", sourceId(individualBeforeFolder)).put("name", "Clip.mp4").put("mime", "video/mp4")
        File(directory, "individual-before-folder.json").writeText(independent.toString())
        val legacy = JSONObject().put("id", "legacy").put("uri", Uri("selected", "nested-clip", "document").toString())
            .put("grantUri", tree.toString()).put("sourceId", sourceId(tree)).put("name", "Clip.mp4").put("mime", "video/mp4")
        File(directory, "legacy.json").writeText(legacy.toString())
        val published = mutableListOf<JSONObject>()
        scanTree(tree) { published.add(it) }
        check(metadataReads == 1) { "one metadata index per tree, not per file" }
        val byUri = published.associateBy { it.getString("uri") }
        fun row(id: String) = byUri.getValue(Uri("selected", id, "document").toString())
        check(row("root-clip").getString("relativePath") == "Clip.mp4")
        check(row("root-clip").getString("id") != independent.getString("id"))
        check(row("root-clip").getString("grantUri") == tree.toString())
        check(JSONObject(File(directory, "individual-before-folder.json").readText()).getString("grantUri") == individualBeforeFolder.toString())
        val refreshed = mutableListOf<JSONObject>()
        scanTree(tree) { refreshed.add(it) }
        check(refreshed.associate { it.getString("uri") to it.getString("id") } ==
              published.associate { it.getString("uri") to it.getString("id") })
        check(row("nested-clip").getString("relativePath") == "Season 1/Clip.mp4")
        check(row("nested-clip").getString("name") == "Clip.mp4")
        check(row("unicode-clip").getString("relativePath") == "Кино %20/Фильм.mp4")
        check(row("bad-clip").opt("relativePath") === JSONObject.NULL)
        check(JSONObject(File(directory, "legacy.json").readText()).getString("relativePath") == "Season 1/Clip.mp4")
        val individual = Uri("individual", "picked", "document")
        link(individual, individual, mutableSetOf(), "Picked.mp4") { published.add(it) }
        check(published.last().opt("relativePath") === JSONObject.NULL)
        val wrongGrant = Uri("different")
        val retained = row("nested-clip")
        link(Uri("selected", "nested-clip", "document"), wrongGrant,
            mutableSetOf(retained.getString("uri")), "Clip.mp4", "video/mp4", "Other", "Wrong.mp4", retained) {
            check(it.getString("relativePath") == "Season 1/Clip.mp4")
        }
        for (name in listOf("", ".", "..", "bad/name", "bad\\name", "bad\u0000name"))
            check(relativeChildPath("", name) == null)
        check(relativeChildPath(null, "Clip.mp4") == null)
        check(relativeChildPath("", "x".repeat(8193)) == null)
        println("PASS actual Android tree/link: root, nested, Unicode, invalid names, legacy upgrade, individual null, grant isolation")
    }
}
fun main() {
    val directory = Files.createTempDirectory("ott-local-paths-").toFile()
    try { Harness(directory).run() } finally { directory.deleteRecursively() }
}
'''
        with tempfile.TemporaryDirectory(prefix="ott-android-paths-") as temporary:
            temporary = Path(temporary)
            script, jar = temporary / "Paths.kt", temporary / "paths.jar"
            script.write_text(code)
            subprocess.run([shutil.which("kotlinc") or "kotlinc", str(script), "-include-runtime", "-d", str(jar)], check=True, timeout=90)
            java = str(Path(os.environ["JAVA_HOME"]) / "bin/java") if os.environ.get("JAVA_HOME") else "java"
            subprocess.run([java, "-jar", str(jar)], check=True, timeout=20)

    def test_ios_actual_refresh_and_published_row(self):
        source = (ROOT / "ios/App/App/Plugins/LocalMedia.swift").read_text()
        methods = "\n".join(function(source, marker) for marker in (
            "private struct LinkedItem:", "private struct Source:", "private func child(",
            "private func linkedItemID(", "private func refresh(", "func linked(",
        ))
        self.assertEqual(source.count('"relativePath": NSNull()'), 3)
        self.assertEqual(source.count('"relativePath": source.kind == "folder" ? item.path as Any : NSNull()'), 2)
        code = r'''
import Foundation
import CryptoKit
class Bridge { func portablePath(fromLocalURL url: URL) -> URL? { url } }
class Harness {
    let bridge: Bridge? = Bridge()
    var cancelled = false
    var persistenceURL: URL?
    func checkWork() throws { if cancelled { throw URLError(.cancelled) } }
    private func save(_ source: Source) throws {
        try checkWork()
        if let url = persistenceURL { try JSONEncoder().encode(source).write(to: url, options: .atomic) }
    }
    var mediaReads = 0
    func mediaInfo(_ url: URL) -> (String, Int64)? {
        mediaReads += 1
        var directory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &directory), !directory.boolValue else { return nil }
        return ("video/mp4", 1)
    }
''' + methods.replace("func linked(", "private func linked(") + r'''
    func run(_ root: URL) throws {
        let names = ["Clip.mp4", "Season 1/Clip.mp4", "Кино %20/Фильм.mp4"]
        for name in names {
            let url = root.appendingPathComponent(name)
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data([1]).write(to: url)
        }
        var source = Source(id: "folder", name: "Movies", kind: "folder", bookmark: Data(), items: [], excluded: [])
        let identity = source
        var streamed: [[String: Any]] = []
        try refresh(&source, root: root, onItem: { item, url in
            streamed.append(self.linked(item, identity, url, validated: true))
        })
        check(mediaReads == names.count)
        check(streamed.count == names.count && streamed.allSatisfy { $0["available"] as? Bool == true })
        let rows = source.items.map { linked($0, source, root.appendingPathComponent($0.path)) }
        check(Set(rows.compactMap { $0["relativePath"] as? String }) == Set(names))
        check(rows.allSatisfy { ($0["name"] as? String)?.contains("/") == false })
        var file = Source(id: "file", name: "Clip.mp4", kind: "file", bookmark: Data(), items: [], excluded: [])
        let beforeFile = mediaReads
        try refresh(&file, root: root.appendingPathComponent("Clip.mp4"))
        check(mediaReads == beforeFile + 1)
        check(linked(file.items[0], file, root.appendingPathComponent("Clip.mp4"))["relativePath"] is NSNull)
        // Reopen the actual persisted source after an interrupted first scan.
        // No item list was committed, so a random per-discovery UUID would fail.
        persistenceURL = root.deletingLastPathComponent().appendingPathComponent("checkpoint.source.json")
        var checkpoint = Source(id: "saved-source", name: "Checkpoint", kind: "folder", bookmark: Data(), items: [], excluded: [])
        try save(checkpoint)
        let persistedBefore = try Data(contentsOf: persistenceURL!)
        var firstPublished: (String, String)?
        do {
            try refresh(&checkpoint, root: root, onItem: { item, _ in
                firstPublished = (item.path, item.id)
                self.cancelled = true
            })
            preconditionFailure("cancelled refresh must not finish")
        } catch { check(cancelled) }
        check(firstPublished != nil)
        let persistedAfterCancellation = try Data(contentsOf: persistenceURL!)
        check(persistedAfterCancellation == persistedBefore)
        cancelled = false
        var reopened = try JSONDecoder().decode(Source.self, from: Data(contentsOf: persistenceURL!))
        check(reopened.items.isEmpty)
        try refresh(&reopened, root: root)
        check(reopened.items.first(where: { $0.path == firstPublished!.0 })!.id == firstPublished!.1)
        let committed = try JSONDecoder().decode(Source.self, from: Data(contentsOf: persistenceURL!))
        check(committed.items.first(where: { $0.path == firstPublished!.0 })!.id == firstPublished!.1)
        check(UUID(uuidString: firstPublished!.1) != nil)
        check(linkedItemID("other-source", path: firstPublished!.0) != firstPublished!.1)
        check(linkedItemID("saved-source", path: firstPublished!.0 + "/different") != firstPublished!.1)
        let legacyID = UUID().uuidString.lowercased()
        reopened.items[0].id = legacyID
        let legacyPath = reopened.items[0].path
        try refresh(&reopened, root: root)
        check(reopened.items.first(where: { $0.path == legacyPath })!.id == legacyID)
        persistenceURL = nil
        let beforeSaved = mediaReads
        check(linked(file.items[0], file, root.appendingPathComponent("Clip.mp4"))["available"] as? Bool == true)
        check(mediaReads == beforeSaved + 1)
        try FileManager.default.removeItem(at: root.appendingPathComponent("Clip.mp4"))
        check(linked(file.items[0], file, root.appendingPathComponent("Clip.mp4"))["available"] as? Bool == false)
        check(linked(file.items[0], file, root.appendingPathComponent("different.mp4"))["available"] as? Bool == false)
        _ = try JSONSerialization.data(withJSONObject: rows)
        print("PASS actual iOS refresh/row: root, nested, Unicode, individual null")
    }
}
func check(_ value: @autoclosure () -> Bool) { precondition(value()) }
let root = URL(fileURLWithPath: CommandLine.arguments[1])
defer { try? FileManager.default.removeItem(at: root) }
try Harness().run(root)
'''
        # macOS exposes /var and /private/var aliases differently to URL
        # enumeration. Keep this provenance test outside that unrelated alias.
        with tempfile.TemporaryDirectory(prefix="ott-ios-paths-", dir=Path.home()) as temporary:
            script = Path(temporary) / "Paths.swift"
            script.write_text(code)
            subprocess.run([shutil.which("swift") or "swift", str(script), str(Path(temporary) / "Media")], check=True, timeout=90)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("all", "android", "ios"), default="all")
    args = parser.parse_args()
    methods = {
        "android": "test_android_actual_tree_and_metadata_upgrade",
        "ios": "test_ios_actual_refresh_and_published_row",
    }
    result = unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(
        MobileLocalPaths(method)
        for platform, method in methods.items()
        if args.platform in ("all", platform)
    ))
    raise SystemExit(not result.wasSuccessful())
