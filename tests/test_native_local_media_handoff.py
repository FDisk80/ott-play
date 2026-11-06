"""Exercise actual mobile handoff callbacks with deterministic platform doubles.

--source-only uses only Python. Native modes compile the extracted production
methods and real NativeWork owner; they are not device/provider acceptance.
"""
import argparse
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android/app/src/main/java/play/ott/foss"
IOS = ROOT / "ios/App/App/Plugins"


def method(source, marker):
    start = source.index(marker)
    end = source.index("{", start) + 1
    depth = 1
    while depth:
        depth += (source[end] == "{") - (source[end] == "}")
        end += 1
    return source[start:end]


def android_source():
    source = (ANDROID / "LocalMediaPlugin.kt").read_text()
    methods = "\n".join(method(source, marker) for marker in (
        "private fun selected(", "private fun selectedFolder(",
        "private fun sourceDescriptors(", "private fun resolveRegistration(",
        "fun sources(", "private fun progressList(", "private fun link(",
    ))
    return r'''
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.util.UUID
import play.ott.foss.NativeWork
import play.ott.foss.LocalMediaAvailability
open class JSONObject() {
    constructor(raw: String): this() { values.putAll(snapshots.getValue(raw)) }
    val values = mutableMapOf<String, Any?>()
    open fun put(key: String, value: Any?): JSONObject { values[key] = value; return this }
    fun getString(key: String) = values[key] as String
    fun optString(key: String, fallback: String = "") = values[key] as? String ?: fallback
    fun optLong(key: String, fallback: Long = 0) = (values[key] as? Number)?.toLong() ?: fallback
    fun getBoolean(key: String) = values[key] as? Boolean
    fun has(key: String) = values.containsKey(key)
    fun opt(key: String) = values[key]
    override fun toString(): String {
        val id = "snapshot-${snapshots.size}"; snapshots[id] = values.toMap(); return id
    }
    companion object { val NULL = Any(); val snapshots = mutableMapOf<String, Map<String, Any?>>() }
}
class JSObject: JSONObject() {
    override fun put(key: String, value: Any?): JSObject { super.put(key, value); return this }
}
class JSArray(val values: List<Any?> = emptyList()) {
    fun length() = values.size
    fun optString(index: Int) = values[index] as? String ?: ""
}
class PluginCall(val options: Map<String, Any?> = emptyMap()) {
    val replies = mutableListOf<Any?>(); val errors = mutableListOf<String>()
    fun getBoolean(key: String) = options[key] as? Boolean
    fun getString(key: String) = options[key] as? String
    fun getArray(key: String) = (options[key] as? List<*>)?.let { JSArray(it) }
    fun resolve(value: Any? = null) { replies.add(value) }
    fun reject(message: String) { errors.add(message) }
}
data class Uri(val value: String) {
    val lastPathSegment: String? get() = value
    override fun toString() = value
    companion object { fun parse(value: String) = Uri(value) }
}
object DocumentsContract {
    fun getTreeDocumentId(uri: Uri) = uri.value
    object Document { const val COLUMN_DOCUMENT_ID = "id" }
}
object Activity { const val RESULT_OK = 1 }
class ClipItem(val uri: Uri)
class ClipData(val items: List<Uri>) {
    val itemCount get() = items.size
    fun getItemAt(index: Int) = ClipItem(items[index])
}
class PickData(val data: Uri?, val clipData: ClipData? = null)
class ActivityResult(val resultCode: Int, val data: PickData?)
class Cursor: AutoCloseable { fun moveToFirst() = false; fun getString(column: Int) = "Clip.mp4"; override fun close() {} }
object OpenableColumns { const val DISPLAY_NAME = "name" }
object LocalMediaRange { fun mime(name: String) = "video/mp4" }
class Opened: AutoCloseable { val size = 123L; override fun close() {} }
class Permission(val uri: Uri, val isReadPermission: Boolean = true)
class Resolver { val persistedUriPermissions = listOf(Permission(Uri("selected"))); fun getType(uri: Uri) = "video/mp4" }
class Context { val contentResolver = Resolver() }
class Harness(val directory: File) {
    val ticket = NativeWork.begin()!!
    val currentWork = ThreadLocal<NativeWork.Ticket>().apply { set(ticket) }
    val context = Context(); val token = "token"
    var picking = true; var scans = 0; var snapshots = 0; var opens = 0; var metadataReads = 0
    var failSave = false; var cancelAfterFirst = false; var firstPlayable = false; var revoked = false
    val saved = mutableListOf<JSONObject>(); val records = mutableListOf<JSONObject>()
    val released = mutableListOf<String>(); val events = mutableListOf<JSObject>()
    fun checkWork() = ticket.check()
    fun submit(call: PluginCall, action: () -> Unit) { try { checkWork(); action() } catch (_: Exception) { call.reject("cancelled") } }
    fun validId(id: String) = id.isNotEmpty()
    fun sourceId(uri: Uri) = uri.value
    fun sourceId(item: JSONObject) = item.optString("sourceId").ifEmpty { item.getString("id") }
    fun sourceMetadata(): List<JSONObject> { checkWork(); return saved.toList() }
    fun metadata(): List<JSONObject> {
        checkWork(); metadataReads++
        return (records + directory.listFiles().orEmpty().filter { it.extension == "json" }
            .map { JSONObject(it.readText()) }).associateBy { it.getString("id") }.values.toList()
    }
    fun readMetadata(file: File): JSONObject? = if (file.exists()) JSONObject(file.readText()) else null
    fun grant(uri: Uri) { checkWork() }
    fun saveSource(uri: Uri, name: String, kind: String) {
        if (failSave) { ticket.cancel(); checkWork() }
        ticket.commit {
            saved.removeAll { it.optString("id") == sourceId(uri) }
            saved.add(JSONObject().put("id", sourceId(uri)).put("name", name).put("kind", kind).put("grantUri", uri.value))
        }
    }
    fun releaseUnusedGrant(uri: String, referenced: Boolean) { if (!referenced) released.add(uri) }
    fun query(uri: Uri, columns: Array<String>) = Cursor()
    fun startServer() = 1234
    private class UnavailableDocument(cause: Exception): IOException(cause)
    fun openSource(item: JSONObject): Opened {
        checkWork(); opens++
        if (revoked) throw IOException("revoked source")
        if (sourceId(item) == "unrelated") {
            check(firstPlayable) { "unrelated original was opened before first selected publication" }
            throw IOException("unavailable unrelated provider")
        }
        return Opened()
    }
    fun entry(source: String) = JSONObject().put("id", source + "-item").put("name", "Clip.mp4")
        .put("mime", "video/mp4").put("size", 123L).put("sourceId", source).put("uri", source)
    fun scanTree(uri: Uri, onValidatedRecord: ((JSONObject) -> Unit)? = null, onRecord: ((JSONObject) -> Unit)? = null) {
        checkWork(); scans++
        if (uri.value == "unrelated") { check(firstPlayable); throw IOException("unavailable unrelated folder") }
        val existing = records.find { it.optString("uri") == uri.value }
        link(uri, uri, records.mapTo(mutableSetOf()) { it.optString("uri") }, "Clip.mp4", "video/mp4",
             existing = existing, onValidatedRecord = onValidatedRecord, onRecord = onRecord)
        if (cancelAfterFirst) ticket.cancel()
    }
    fun resolveSnapshot(call: PluginCall) { checkWork(); snapshots++; call.resolve(JSObject()) }
    fun notifyListeners(name: String, event: JSObject) {
        val catalog = event.opt("catalog") as JSObject
        if ((catalog.opt("items") as JSArray).values.any { (it as JSObject).getBoolean("available") == true }) firstPlayable = true
        events.add(event)
    }
''' + methods + r'''
    fun folder(call: PluginCall, accepted: Boolean = true) = selectedFolder(call,
        ActivityResult(if (accepted) Activity.RESULT_OK else 0, PickData(Uri("selected"))))
    fun files(call: PluginCall, accepted: Boolean = true, uris: List<Uri> = listOf(Uri("one"), Uri("two"))) = selected(call,
        ActivityResult(if (accepted) Activity.RESULT_OK else 0, PickData(null, ClipData(uris))))
    fun progress(call: PluginCall) = progressList(call, "owned")
}
fun main() {
    NativeWork.setStandby(false)
    val root = Files.createTempDirectory("ott-native-handoff-").toFile()
    fun withOwner(action: (Harness) -> Unit) {
        val owner = Harness(Files.createTempDirectory(root.toPath(), "owner-").toFile())
        try { action(owner) } finally { owner.ticket.finish() }
    }
    try {
        for (folder in listOf(true, false)) withOwner { h ->
            val call = PluginCall(mapOf("progressive" to true))
            if (folder) h.folder(call) else h.files(call)
            check(h.scans == 0 && h.snapshots == 0 && h.opens == 0)
            check(call.errors.isEmpty() && call.replies.size == 1)
            val reply = call.replies.single() as JSObject
            check((reply.opt("sourceIds") as JSArray).length() == if (folder) 1 else 2)
            check(!reply.has("sources"))
            check(h.metadataReads == if (folder) 0 else 1)
        }
        for (option in listOf(null, false, "true")) withOwner { h ->
            val call = PluginCall(mapOf("progressive" to option)); h.folder(call)
            check(h.scans == 1 && h.snapshots == 1)
        }
        for (folder in listOf(true, false)) withOwner { h ->
            val call = PluginCall(mapOf("progressive" to true))
            if (folder) h.folder(call, false) else h.files(call, false)
            check(h.saved.isEmpty() && h.scans == 0 && h.snapshots == 0)
            check((call.replies.single() as JSObject).getBoolean("pickerCancelled") == true)
        }
        withOwner { h ->
            h.failSave = true; val call = PluginCall(mapOf("progressive" to true)); h.files(call)
            check(call.replies.isEmpty() && call.errors.size == 1 && h.saved.isEmpty())
            check(h.released == listOf("one"))
        }
        for (cancel in listOf(false, true)) withOwner { h ->
            h.saveSource(Uri("unrelated"), "Unrelated", "folder")
            h.saveSource(Uri("selected"), "Selected", "folder")
            h.records.add(h.entry("unrelated"))
            val sources = PluginCall(); h.sources(sources)
            check(h.opens == 0 && h.scans == 0)
            check(((sources.replies.single() as JSObject).opt("sources") as JSArray).values.all { !(it as JSObject).has("available") })
            h.cancelAfterFirst = cancel
            val call = PluginCall(mapOf("sourceIds" to listOf("selected")))
            val result = runCatching { h.progress(call) }
            check(h.firstPlayable && h.opens == if (cancel) 1 else 2)
            if (cancel) {
                check(result.isFailure && call.replies.isEmpty())
                val count = h.events.size
                NativeWork.setStandby(false)
                check(runCatching { h.progress(call) }.isFailure && h.events.size == count)
            } else check(result.isSuccess && call.replies.size == 1)
        }
        withOwner { h ->
            h.saveSource(Uri("selected"), "Selected", "folder")
            h.records.add(h.entry("selected"))
            h.revoked = true
            val call = PluginCall(mapOf("sourceIds" to listOf("selected")))
            h.progress(call)
            check(!h.firstPlayable && h.opens >= 1)
            val rows = ((call.replies.single() as JSObject).opt("items") as JSArray).values
            check(rows.all { (it as JSObject).getBoolean("available") == false })
        }
        withOwner { h ->
            val original = h.entry("folder").put("uri", "shared").put("grantUri", "folder")
            h.records.add(original)
            h.saveSource(Uri("folder"), "Folder", "folder")
            val pick = PluginCall(mapOf("progressive" to true))
            h.files(pick, uris = listOf(Uri("shared")))
            check(pick.replies.size == 1 && h.opens == 0)
            check(((pick.replies.single() as JSObject).opt("sourceIds") as JSArray).values == listOf("shared"))
            val call = PluginCall(mapOf("sourceIds" to listOf("shared")))
            h.progress(call)
            val firstReady = h.events.map { (it.opt("catalog") as JSObject).opt("items") as JSArray }
                .first { rows -> rows.values.any { (it as JSObject).getBoolean("available") == true } }
            check(firstReady.values.any { value -> val row = value as JSObject; row.getString("sourceId") == "shared" && row.getBoolean("available") == true })
            val selected = h.metadata().filter { it.optString("grantUri") == "shared" }
            check(selected.size == 1 && selected.single().getString("id") != original.getString("id"))
            check(selected.single().getString("sourceId") == "shared")
            check(original.getString("sourceId") == "folder" && original.getString("grantUri") == "folder")
            val newId = selected.single().getString("id")
            h.progress(PluginCall(mapOf("sourceIds" to listOf("shared"))))
            check(h.metadata().filter { it.optString("grantUri") == "shared" }.single().getString("id") == newId)
        }
        check(NativeWork.snapshot().pending == 0)
        println("PASS Android actual handoff: deferred/legacy/cancelled picker, unknown sources, selected-before-unrelated, owned cancellation")
    } finally { root.deleteRecursively() }
}
'''


def ios_source():
    source = (IOS / "LocalMedia.swift").read_text()
    methods = "\n".join(method(source, marker) for marker in (
        "private struct LinkedItem:", "private struct Source:", "private struct Entry:",
        "private func sourceDescriptors(", "private func resolveRegistration(",
        "func sources(_ call:", "private func progressSnapshot(",
        "public func documentPickerWasCancelled(", "public func documentPicker(_ controller:",
    ))
    # Only the framework URL type is replaced; callback/control-flow bodies are
    # production bytes. Fake URLs count accesses instead of contacting Files.
    methods = re.sub(r"\bURL\b", "FixtureURL", methods).replace("public func ", "func ")
    work = (IOS / "NativeBackground.swift").read_text().split("@objc(NativeBackground)", 1)[0].replace("import Capacitor\n", "")
    return work + r'''
enum Key { case isDirectoryKey, isSymbolicLinkKey, isRegularFileKey }
enum BookmarkOptions { case minimalBookmark }
struct Values { var isDirectory = true; var isSymbolicLink = false }
struct FixtureURL {
    let path: String
    static var originalReads = 0
    var lastPathComponent: String { path }
    var absoluteString: String { "fixture:" + path }
    var pathExtension: String { "" }
    func startAccessingSecurityScopedResource() -> Bool { true }
    func stopAccessingSecurityScopedResource() {}
    func resourceValues(forKeys: Set<Key>) throws -> Values { Self.originalReads += 1; return Values() }
    func bookmarkData(options: BookmarkOptions, includingResourceValuesForKeys: [String]?, relativeTo: FixtureURL?) throws -> Data { Data(path.utf8) }
    func appendingPathComponent(_ path: String) -> FixtureURL { FixtureURL(path: self.path + "/" + path) }
    func deletingLastPathComponent() -> FixtureURL { self }
}
class FileManager {
    static let `default` = FileManager()
    func contentsOfDirectory(at: FixtureURL, includingPropertiesForKeys: [String]?) throws -> [FixtureURL] { [] }
    func fileExists(atPath: String) -> Bool { false }
    func removeItem(at: FixtureURL) throws {}
}
class UIDocumentPickerViewController {}
class CAPPluginCall {
    let options: [String: Any]
    var replies: [[String: Any]] = []; var errors: [String] = []
    init(_ options: [String: Any] = [:]) { self.options = options }
    func getBool(_ key: String) -> Bool? { options[key] as? Bool }
    func getString(_ key: String) -> String? { options[key] as? String }
    func getArray<T>(_ key: String, _ type: T.Type) -> [T]? { options[key] as? [T] }
    func resolve(_ value: [String: Any]) { replies.append(value) }
    func reject(_ value: String) { errors.append(value) }
}
class Bridge { func portablePath(fromLocalURL url: FixtureURL) -> FixtureURL? { url } }
class Harness {
    let currentWork: NativeWork.Ticket? = NativeWork.shared.begin()!
    let bridge: Bridge? = Bridge()
    var pendingPicker: CAPPluginCall?
    var pickingFolder = true
    var replacingSource: String?
    private var stored: [Source] = []
    var refreshes = 0; var snapshots = 0; var lists = 0; var firstPlayable = false; var sourceReads = 0
    var failSave = false; var cancelAfterFirst = false; var events: [[String: Any]] = []
    deinit { currentWork?.finish() }
    func checkWork() throws { try currentWork?.check() }
    func tracked(_ call: CAPPluginCall, _ action: () -> Void) { action() }
    private func sources() throws -> [Source] { try checkWork(); sourceReads += 1; return stored }
    func directory() throws -> FixtureURL { try checkWork(); return FixtureURL(path: "private") }
    func readMetadata(_ url: FixtureURL) throws -> Data? { nil }
    func regularPrivateFile(_ file: FixtureURL, in directory: FixtureURL) -> Bool { false }
    private func save(_ source: Source) throws {
        if failSave { currentWork?.cancelWork() }
        try currentWork?.commit { stored.removeAll { $0.id == source.id }; stored.append(source) }
    }
    func release(_ id: String) {}
    func sourceFile(_ id: String) throws -> FixtureURL { FixtureURL(path: id) }
    func resolveSnapshot(_ call: CAPPluginCall) throws { try checkWork(); snapshots += 1; call.resolve([:]) }
    func list(_ call: CAPPluginCall) { lists += 1 }
    private func resolve(_ source: inout Source) throws -> FixtureURL {
        try checkWork()
        if source.id == "unrelated" {
            precondition(firstPlayable, "unrelated source accessed before selected publication")
            throw CocoaError(.fileReadNoPermission)
        }
        return FixtureURL(path: source.id)
    }
    func child(_ path: String, root: FixtureURL) -> FixtureURL? { root.appendingPathComponent(path) }
    func mediaInfo(_ url: FixtureURL) -> (String, Int64)? { FixtureURL.originalReads += 1; return ("video/mp4", 1) }
    private func refresh(_ source: inout Source, root: FixtureURL,
                         onItem: ((LinkedItem, FixtureURL) -> Void)? = nil, onScan: (() -> Void)? = nil) throws {
        try checkWork(); refreshes += 1
        let item = LinkedItem(id: source.id + "-item", name: "Clip.mp4", path: "Clip.mp4", mime: "video/mp4", size: 1)
        _ = mediaInfo(root)
        source.items = [item]; onItem?(item, root.appendingPathComponent(item.path)); onScan?()
        if cancelAfterFirst { currentWork?.cancelWork() }
    }
    func notifyListeners(_ name: String, data: [String: Any]) {
        let catalog = data["catalog"] as! [String: Any]
        if (catalog["items"] as! [[String: Any]]).contains(where: { $0["available"] as? Bool == true }) { firstPlayable = true }
        events.append(data)
    }
''' + methods + r'''
    func pick(_ call: CAPPluginCall, folder: Bool = true) {
        pendingPicker = call; pickingFolder = folder
        documentPicker(UIDocumentPickerViewController(), didPickDocumentsAt: [FixtureURL(path: "selected")])
    }
    func configureSources() {
        stored = [Source(id: "unrelated", name: "Unrelated", kind: "folder", bookmark: Data(), items: [], excluded: []),
                  Source(id: "selected", name: "Selected", kind: "folder", bookmark: Data(), items: [], excluded: [])]
    }
    func progress(_ call: CAPPluginCall) throws { try progressSnapshot(call, requestId: "owned") }
}
NativeWork.shared.setStandby(false)
for folder in [false, true] {
    let h = Harness(); let call = CAPPluginCall(["progressive": true]); FixtureURL.originalReads = 0
    h.pick(call, folder: folder)
    precondition(call.errors.isEmpty && call.replies.count == 1 && h.refreshes == 0 && h.snapshots == 0 && FixtureURL.originalReads == 0)
    precondition((call.replies[0]["sourceIds"] as! [String]).count == 1)
    precondition(call.replies[0]["sources"] == nil && h.sourceReads == 0)
}
for option in [false as Any, "true" as Any] {
    let h = Harness(); let call = CAPPluginCall(["progressive": option]); h.pick(call)
    precondition(h.refreshes == 1 && h.snapshots == 1)
}
do {
    let h = Harness(); let call = CAPPluginCall(["progressive": true]); h.pendingPicker = call
    h.documentPickerWasCancelled(UIDocumentPickerViewController())
    precondition(h.lists == 0 && call.replies[0]["pickerCancelled"] as? Bool == true)
}
do {
    let h = Harness(); h.failSave = true; let call = CAPPluginCall(["progressive": true]); h.pick(call)
    precondition(call.replies.isEmpty && call.errors.count == 1)
}
for cancel in [false, true] {
    let h = Harness(); h.configureSources(); FixtureURL.originalReads = 0
    let sources = CAPPluginCall(); h.sources(sources)
    precondition(FixtureURL.originalReads == 0 && h.refreshes == 0)
    precondition((sources.replies[0]["sources"] as! [[String: Any]]).allSatisfy { $0["available"] == nil })
    h.cancelAfterFirst = cancel
    let call = CAPPluginCall(["sourceIds": ["selected"]])
    do { try h.progress(call); precondition(!cancel) } catch { precondition(cancel) }
    precondition(h.firstPlayable && FixtureURL.originalReads == 1)
    if cancel {
        precondition(call.replies.isEmpty)
        let count = h.events.count
        do { try h.progress(call); preconditionFailure("retired request resumed") } catch {}
        precondition(h.events.count == count)
    } else { precondition(call.replies.count == 1) }
}
precondition(NativeWork.shared.snapshot["pending"] as? Int == 0)
print("PASS iOS actual handoff: deferred/legacy/cancelled picker, unknown sources, selected-before-unrelated, owned cancellation")
'''


class SourceContracts(unittest.TestCase):
    def test_android_deferred_boundary_and_live_validation(self):
        source = (ANDROID / "LocalMediaPlugin.kt").read_text()
        picker = method(source, "private fun selectedFolder(")
        branch = method(picker, 'if (call.getBoolean("progressive") == true)')
        self.assertIn("resolveRegistration(call", branch)
        self.assertNotIn("scanTree(", branch)
        self.assertNotIn("resolveSnapshot(", branch)
        self.assertIn("return@submit", branch)
        descriptors = method(source, "private fun sourceDescriptors(")
        self.assertNotIn("openSource(", descriptors)
        self.assertNotIn('put("available"', descriptors)
        self.assertIn("openSource(item)", method(source, "private fun progressList("))

    def test_ios_deferred_boundary_and_live_validation(self):
        source = (IOS / "LocalMedia.swift").read_text()
        picker = method(source, "public func documentPicker(_ controller:")
        self.assertIn('let progressive = call.getBool("progressive") == true', picker)
        self.assertIn("if progressive { try self.save(source) }", picker)
        self.assertIn("else { try self.refresh(&source, root: url) }", picker)
        descriptors = method(source, "private func sourceDescriptors(")
        self.assertNotIn("mediaInfo(", descriptors)
        self.assertNotIn('"available":', descriptors)
        self.assertIn("mediaInfo($0)", method(source, "private func progressSnapshot("))


def run_native(platform):
    with tempfile.TemporaryDirectory(prefix="ott-native-handoff-") as name:
        temp = Path(name)
        if platform == "android":
            script, clock, binary = temp / "Main.kt", temp / "Clock.kt", temp / "handoff.jar"
            script.write_text(android_source())
            clock.write_text("package android.os\nobject SystemClock { fun elapsedRealtime(): Long = System.nanoTime() / 1000000 }\n")
            subprocess.run([shutil.which("kotlinc") or "kotlinc", str(ANDROID / "NativeWork.kt"),
                            str(ANDROID / "LocalMediaAvailability.kt"), str(clock), str(script),
                            "-include-runtime", "-d", str(binary)], check=True, timeout=90)
            java = str(Path(os.environ["JAVA_HOME"]) / "bin/java") if os.environ.get("JAVA_HOME") else "java"
            subprocess.run([java, "-jar", str(binary)], check=True, timeout=20)
        else:
            script, binary = temp / "main.swift", temp / "handoff"
            script.write_text(ios_source())
            subprocess.run([shutil.which("swiftc") or "swiftc", str(script), "-o", str(binary)], check=True, timeout=90)
            subprocess.run([str(binary)], check=True, timeout=20)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", choices=("all", "android", "ios"), default="all")
    parser.add_argument("--source-only", action="store_true")
    parser.add_argument("--emit", type=Path, help="Write generated harnesses without compiling")
    args = parser.parse_args()
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SourceContracts))
    if not result.wasSuccessful():
        raise SystemExit(1)
    if args.emit:
        args.emit.mkdir(parents=True, exist_ok=True)
        (args.emit / "Main.kt").write_text(android_source())
        (args.emit / "main.swift").write_text(ios_source())
    if not args.source_only:
        for platform in ("android", "ios"):
            if args.platform in ("all", platform):
                run_native(platform)
