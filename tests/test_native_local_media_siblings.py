"""Actual native discovery/scan code with deterministic held-I/O platform doubles.

Native modes compile extracted production code, never launch an app/device. The
source-only mode emits/checks fixture construction without invoking a compiler.
"""
from pathlib import Path
import argparse
import os
import shutil
import subprocess
import tempfile
import unittest

from test_mobile_local_paths import ROOT, android_source, ios_source, function


def android_fixture():
    source = (ROOT / "android/app/src/main/java/play/ott/foss/LocalMediaPlugin.kt").read_text()
    code = android_source()
    code = code.replace("import java.io.File", "import play.ott.foss.NativeWork\nimport java.util.concurrent.*\nimport java.util.concurrent.atomic.*\nimport java.io.File", 1)
    code = code.replace("val currentWork = ThreadLocal<Work>()", "val currentWork = ThreadLocal<NativeWork.Ticket>()")
    code = code.replace("private fun discovery() = LocalMediaDiscovery({ checkWork() }, { action, _ -> discoveryWorkers.execute(action) })",
        function(source, "private class QueuedWork(") + "\n" + function(source, "private fun discovery()") + r'''
    val owner = Executors.newSingleThreadExecutor()
    fun beginWork() = NativeWork.begin()
    fun finishWork(ticket: NativeWork.Ticket) = ticket.finish()
    val currentGate = Gate()
    var heldOpen = ""
    var heldQuery = ""
    var heldParentNext = false
    val published = AtomicInteger()
    val firstReady = CountDownLatch(1)
''')
    code = code.replace("val documents = mapOf(", "var documents = mapOf(")
    code = code.replace("fun checkWork() {}", "fun checkWork() { currentWork.get()?.check() }")
    a = code.index("fun query(uri: Uri,"); b = code.index("fun saveSource", a)
    code = code[:a] + r'''
    fun query(uri: Uri, columns: Array<String>): Cursor? {
        if (uri.document == heldQuery) currentGate.hold()
        val cursor = Cursor(if (uri.kind == "children") documents[uri.document].orEmpty() else listOf(listOf("Movies")))
        if (heldParentNext && uri.kind == "children" && uri.document == "root") cursor.beforeNext = { index -> if (index == 1) currentGate.hold() }
        return cursor
    }
    ''' + code[b:]
    code = code.replace("fun openSource(item: JSONObject) = Media()", "fun openSource(item: JSONObject): Media { if (item.getString(\"name\") == heldOpen) currentGate.hold(); return Media() }")
    code = code.replace("private var index = -1", "private var index = -1\n    var beforeNext: (Int) -> Unit = {}")
    code = code.replace("fun moveToNext(): Boolean { index++;", "fun moveToNext(): Boolean { beforeNext(index + 1); index++;")
    # The JSONObject boundary double must itself be safe under worker reads.
    code = code.replace('"snapshot-${snapshots.size}"', '"snapshot-${serial.incrementAndGet()}"')
    code = code.replace("val snapshots = mutableMapOf<String, Map<String, Any>>()", "val snapshots = ConcurrentHashMap<String, Map<String, Any>>(); val serial = AtomicInteger()")
    methods = r'''
    fun heldCase(kind: String) {
        documents = when (kind) {
            "file" -> mapOf("root" to listOf(listOf("slow", "Slow.mp4", "video/mp4"), listOf("ready", "Ready.mp4", "video/mp4")))
            "directory" -> mapOf("root" to listOf(listOf("slow", "Slow", "directory"), listOf("ready", "Ready", "directory")), "ready" to listOf(listOf("clip", "Ready.mp4", "video/mp4")))
            else -> mapOf("root" to listOf(listOf("ready", "Ready", "directory")), "ready" to listOf(listOf("clip", "Ready.mp4", "video/mp4")))
        }
        heldOpen = if (kind == "file") "Slow.mp4" else ""
        heldQuery = if (kind == "directory") "slow" else ""
        heldParentNext = kind == "parent-next"
        val parent = NativeWork.begin()!!
        val done = owner.submit {
            currentWork.set(parent)
            try {
                scanTree(Uri("selected"), onCheckedRecord = { item, available ->
                    check(available)
                    published.incrementAndGet()
                    if (item.getString("name") == "Ready.mp4") firstReady.countDown()
                })
            } catch (_: IOException) { parent.checkCancelled() }
            finally { currentWork.remove(); parent.finish() }
        }
        try {
            check(currentGate.entered.await(4, TimeUnit.SECONDS)) { "held operation never started: $kind" }
            check(firstReady.await(4, TimeUnit.SECONDS)) { "ready sibling was blocked: $kind" }
            check(!done.isDone) { "scan completed while original I/O remained held" }
            parent.cancel()
            val before = published.get()
            check(NativeWork.pendingCount > 0) { "cancel dropped unfinished ownership" }
            val nextStarted = CountDownLatch(1)
            val next = owner.submit { nextStarted.countDown() }
            check(!nextStarted.await(100, TimeUnit.MILLISECONDS)) { "replacement ran before old syscall drained" }
            currentGate.release.countDown()
            done.get(4, TimeUnit.SECONDS); next.get(4, TimeUnit.SECONDS)
            check(published.get() == before) { "cancelled scan published a late item" }
            check(NativeWork.pendingCount == 0)
            println("PASS Android held $kind: first ready before release, no late publication, retained owner")
        } finally { currentGate.release.countDown(); parent.cancel(); done.get(4, TimeUnit.SECONDS) }
    }
    fun saturatedCase() {
        // A/B/C/root-next can saturate a four-worker FIFO, leaving D queued.
        // A then yields a known file: D must never take its probe's last slot.
        val parent = NativeWork.begin()!!
        val tailEntered = CountDownLatch(2)
        val tailRelease = CountDownLatch(1)
        val probe = CountDownLatch(1)
        val done = owner.submit {
            currentWork.set(parent)
            try {
                val jobs = discovery()
                jobs.add(metadata = true) {
                    currentGate.hold()
                    val adopt: () -> Unit = {
                        jobs.add(ready = true) {
                            probe.countDown()
                            val publish: () -> Unit = {}; publish
                        }
                    }; adopt
                }
                repeat(4) { jobs.add(metadata = true) {
                    tailEntered.countDown()
                    check(tailRelease.await(8, TimeUnit.SECONDS))
                    val adopt: () -> Unit = {}; adopt
                } }
                jobs.run()
            } catch (_: IOException) { parent.checkCancelled() }
            finally { currentWork.remove(); parent.finish() }
        }
        try {
            check(currentGate.entered.await(4, TimeUnit.SECONDS))
            check(tailEntered.await(4, TimeUnit.SECONDS))
            currentGate.release.countDown()
            check(probe.await(4, TimeUnit.SECONDS)) { "queued D iterator hid A's known-file probe" }
            check(!done.isDone)
            parent.cancel(); tailRelease.countDown(); done.get(4, TimeUnit.SECONDS)
            check(NativeWork.pendingCount == 0)
            println("PASS Android saturated A/B/C/root-next, queued D: known-file probe precedes blocked metadata")
        } finally { parent.cancel(); currentGate.release.countDown(); tailRelease.countDown(); done.get(4, TimeUnit.SECONDS) }
    }
    fun boundCase() {
        val parent = NativeWork.begin()!!
        val entered = CountDownLatch(4)
        val release = CountDownLatch(1)
        val started = AtomicInteger()
        val adopted = AtomicInteger()
        val done = owner.submit {
            currentWork.set(parent)
            try {
                val jobs = discovery()
                repeat(12) { jobs.add {
                    started.incrementAndGet(); entered.countDown()
                    check(release.await(8, TimeUnit.SECONDS))
                    val adopt: () -> Unit = { adopted.incrementAndGet(); Unit }; adopt
                } }
                jobs.run()
            } catch (_: IOException) { parent.checkCancelled() }
            finally { currentWork.remove(); parent.finish() }
        }
        try {
            check(entered.await(4, TimeUnit.SECONDS)); check(started.get() == 4)
            parent.cancel()
            val replacement = owner.submit { check(started.get() == 4) }
            check(!done.isDone && NativeWork.pendingCount >= 5) { "four child tickets and parent must remain owned" }
            release.countDown(); done.get(4, TimeUnit.SECONDS); replacement.get(4, TimeUnit.SECONDS)
            check(started.get() == 4 && adopted.get() == 0 && NativeWork.pendingCount == 0)
            println("PASS Android four shared slots survive cancellation and suppress queued original reads")
        } finally { release.countDown(); parent.cancel(); done.get(4, TimeUnit.SECONDS) }
    }
'''
    at = code.rindex("fun run() {")
    code = code[:at] + methods + "\n" + code[at:]
    code = code[:code.index("fun main() {")] + r'''
class Gate {
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    fun hold() { entered.countDown(); check(release.await(8, TimeUnit.SECONDS)) { "fixture gate timeout" } }
}
fun NativeWork.Ticket.checkCancelled() { try { check(); error("unexpected scan failure") } catch (_: IOException) {} }
fun main() {
    NativeWork.setStandby(false)
    for (kind in listOf("file", "directory", "parent-next", "saturated", "bound")) {
        val directory = Files.createTempDirectory("ott-siblings-").toFile()
        val harness = Harness(directory)
        try { if (kind == "bound") harness.boundCase() else if (kind == "saturated") harness.saturatedCase() else harness.heldCase(kind) }
        finally { harness.currentGate.release.countDown(); harness.owner.shutdownNow(); harness.discoveryWorkers.shutdownNow(); directory.deleteRecursively() }
    }
}
'''
    return code


def ios_fixture():
    source = (ROOT / "ios/App/App/Plugins/NativeBackground.swift").read_text()
    code = ios_source().replace("import CryptoKit", "import CryptoKit\n" + function(source, "final class NativeWork"), 1)
    # Only OS iterator boundary changes; production scheduler, refresh, safety,
    # item identity and metadata adoption remain byte-for-byte extracted.
    code = code.replace("FileManager.DirectoryEnumerator", "FixtureIterator")
    code = code.replace("FileManager.default.enumerator(at:", "FixtureFS.enumerator(at:")
    code = code.replace("var persistenceURL: URL?", "var persistenceURL: URL?\nvar currentWork: NativeWork.Ticket?\nlet owner = DispatchQueue(label: \"fixture.owner\")\nvar heldName = \"\"\nlet publications = Publications()")
    code = code.replace("func checkWork() throws { if cancelled", "func checkWork() throws { try currentWork?.check(); if cancelled")
    code = code.replace("func mediaInfo(_ url: URL) -> (String, Int64)? {", "func mediaInfo(_ url: URL) -> (String, Int64)? {\n    if url.lastPathComponent == heldName { FixtureFS.gate.hold() }")
    methods = r'''
    func heldCase(_ root: URL, _ kind: String) throws {
        let names: [String]
        if kind == "file" { names = ["a-Slow.mp4", "b-Ready.mp4"]; heldName = "a-Slow.mp4" }
        else if kind == "directory" { names = ["a-Slow/unused.mp4", "b-Ready/Ready.mp4"]; FixtureFS.heldDirectory = "a-Slow" }
        else { names = ["a-Ready/Ready.mp4"]; FixtureFS.heldNextRoot = root.path }
        for name in names {
            let url = root.appendingPathComponent(name)
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data([1]).write(to: url)
        }
        let ticket = NativeWork.shared.begin()!
        let done = DispatchSemaphore(value: 0)
        owner.async {
            self.currentWork = ticket
            defer { self.currentWork = nil; ticket.finish(); done.signal() }
            var source = Source(id: "test", name: "Test", kind: "folder", bookmark: Data(), items: [], excluded: [])
            do {
                try self.refresh(&source, root: root, onItem: { item, _ in self.publications.add(item.name.contains("Ready")) })
            } catch { precondition((try? ticket.check()) == nil, "unexpected traversal failure: \(error)") }
        }
        defer { FixtureFS.gate.open() }
        precondition(FixtureFS.gate.entered.wait(timeout: .now() + 4) == .success)
        precondition(publications.ready.wait(timeout: .now() + 4) == .success, "ready sibling waited for \(kind)")
        ticket.cancelWork()
        let before = publications.count
        precondition(NativeWork.shared.snapshot["pending"] as! Int > 0)
        let next = DispatchSemaphore(value: 0)
        owner.async { next.signal() }
        precondition(next.wait(timeout: .now() + 0.1) == .timedOut, "new generation escaped old owned I/O")
        FixtureFS.gate.open()
        precondition(done.wait(timeout: .now() + 4) == .success)
        precondition(next.wait(timeout: .now() + 4) == .success)
        precondition(publications.count == before && NativeWork.shared.snapshot["pending"] as! Int == 0)
        print("PASS iOS held \(kind): first ready before release, no late publication, retained owner")
    }
    func saturatedCase() {
        let ticket = NativeWork.shared.begin()!
        let first = Gate()
        let tail = MultiGate()
        let probe = DispatchSemaphore(value: 0)
        let done = DispatchSemaphore(value: 0)
        owner.async {
            self.currentWork = ticket
            defer { self.currentWork = nil; ticket.finish(); done.signal() }
            var jobs = [LocalMediaDiscoveryJob(metadata: true) { first.hold(); return 0 }]
            jobs.append(contentsOf: (0..<4).map { _ in LocalMediaDiscoveryJob(metadata: true) { tail.hold(); return 1 } })
            do {
                try self.discover(jobs) { value in
                    if value == 0 { return [LocalMediaDiscoveryJob(ready: true) { probe.signal(); return 2 }] }
                    return []
                }
            } catch { precondition((try? ticket.check()) == nil) }
        }
        precondition(first.entered.wait(timeout: .now() + 4) == .success)
        precondition(tail.waitFor(2))
        first.open()
        precondition(probe.wait(timeout: .now() + 4) == .success, "queued D iterator hid A's known-file probe")
        ticket.cancelWork(); tail.open()
        precondition(done.wait(timeout: .now() + 4) == .success)
        precondition(NativeWork.shared.snapshot["pending"] as! Int == 0)
        print("PASS iOS saturated A/B/C/root-next, queued D: known-file probe precedes blocked metadata")
    }
    func boundCase() {
        let ticket = NativeWork.shared.begin()!
        let gate = MultiGate()
        let done = DispatchSemaphore(value: 0)
        let adopted = Publications()
        owner.async {
            self.currentWork = ticket
            defer { self.currentWork = nil; ticket.finish(); done.signal() }
            do { try self.discover((0..<12).map { value in return LocalMediaDiscoveryJob(ready: true) { gate.hold(); return value } }) { _ in adopted.add(false); return [] } }
            catch { precondition((try? ticket.check()) == nil) }
        }
        precondition(gate.waitForFour())
        ticket.cancelWork()
        let replacement = DispatchSemaphore(value: 0)
        owner.async { replacement.signal() }
        precondition(replacement.wait(timeout: .now() + 0.1) == .timedOut)
        precondition(NativeWork.shared.snapshot["pending"] as! Int == 1)
        gate.open()
        precondition(done.wait(timeout: .now() + 4) == .success)
        precondition(replacement.wait(timeout: .now() + 4) == .success)
        precondition(gate.started == 4 && adopted.count == 0 && NativeWork.shared.snapshot["pending"] as! Int == 0)
        print("PASS iOS four shared slots survive cancellation and suppress queued original reads")
    }
'''
    code = code.replace("func run(_ root: URL) throws {", methods + "\nfunc run(_ root: URL) throws {", 1)
    code = code[:code.index("let root = URL(fileURLWithPath: CommandLine.arguments[1])")] + r'''
final class Publications {
    let lock = NSLock(); var value = 0
    let ready = DispatchSemaphore(value: 0)
    var count: Int { lock.lock(); defer { lock.unlock() }; return value }
    func add(_ first: Bool) { lock.lock(); value += 1; lock.unlock(); if first { ready.signal() } }
}
final class Gate {
    let condition = NSCondition(); var released = false
    let entered = DispatchSemaphore(value: 0)
    func hold() {
        condition.lock(); entered.signal()
        while !released { precondition(condition.wait(until: Date().addingTimeInterval(8)), "fixture gate timeout") }
        condition.unlock()
    }
    func open() { condition.lock(); released = true; condition.broadcast(); condition.unlock() }
}
final class MultiGate {
    let condition = NSCondition(); var released = false; var count = 0
    var started: Int { condition.lock(); defer { condition.unlock() }; return count }
    func hold() {
        condition.lock(); count += 1; condition.broadcast()
        while !released { precondition(condition.wait(until: Date().addingTimeInterval(8))) }
        condition.unlock()
    }
    func waitFor(_ target: Int) -> Bool {
        condition.lock(); defer { condition.unlock() }
        while count < target { if !condition.wait(until: Date().addingTimeInterval(4)) { return false } }
        return count >= target
    }
    func waitForFour() -> Bool { waitFor(4) && started == 4 }
    func open() { condition.lock(); released = true; condition.broadcast(); condition.unlock() }
}
final class FixtureIterator {
    let root: URL; let urls: [URL]; var index = 0
    init(_ root: URL) throws {
        self.root = root
        urls = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]).sorted { $0.path < $1.path }
    }
    func nextObject() -> Any? {
        if root.path == FixtureFS.heldNextRoot && index == 1 { FixtureFS.gate.hold() }
        guard index < urls.count else { return nil }
        defer { index += 1 }; return urls[index]
    }
}
enum FixtureFS {
    static var gate = Gate(); static var heldDirectory = ""; static var heldNextRoot = ""
    static func enumerator(at url: URL, includingPropertiesForKeys: [URLResourceKey]?, options: FileManager.DirectoryEnumerationOptions) -> FixtureIterator? {
        if url.lastPathComponent == heldDirectory { gate.hold() }
        return try? FixtureIterator(url)
    }
}
NativeWork.shared.setStandby(false)
let base = URL(fileURLWithPath: CommandLine.arguments[1])
for kind in ["file", "directory", "parent-next", "saturated", "bound"] {
    FixtureFS.gate = Gate(); FixtureFS.heldDirectory = ""; FixtureFS.heldNextRoot = ""
    let harness = Harness()
    if kind == "bound" { harness.boundCase() }
    else if kind == "saturated" { harness.saturatedCase() }
    else { try harness.heldCase(base.appendingPathComponent(kind), kind) }
}
'''
    return code


class NativeSiblingTests(unittest.TestCase):
    def test_android(self):
        with tempfile.TemporaryDirectory(prefix="ott-native-siblings-") as name:
            directory = Path(name)
            script, jar = directory / "Siblings.kt", directory / "siblings.jar"
            script.write_text(android_fixture())
            subprocess.run([shutil.which("kotlinc") or "kotlinc", str(ROOT / "android/app/src/main/java/play/ott/foss/NativeWork.kt"), str(script), "-include-runtime", "-d", str(jar)], check=True, timeout=90)
            java = str(Path(os.environ["JAVA_HOME"]) / "bin/java") if os.environ.get("JAVA_HOME") else "java"
            subprocess.run([java, "-jar", str(jar)], check=True, timeout=40)

    def test_ios(self):
        with tempfile.TemporaryDirectory(prefix="ott-native-siblings-", dir=Path.home()) as name:
            directory = Path(name)
            script = directory / "Siblings.swift"
            script.write_text(ios_fixture())
            subprocess.run([shutil.which("swift") or "swift", str(script), str(directory / "media")], check=True, timeout=120)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("all", "android", "ios"), default="all")
    parser.add_argument("--source-only", action="store_true")
    parser.add_argument("--emit-dir", type=Path)
    args = parser.parse_args()
    if args.source_only:
        for name, fixture in (("android", android_fixture), ("ios", ios_fixture)):
            code = fixture()
            assert "heldCase" in code and "boundCase" in code and "saturatedCase" in code and len(code) > 1000
            if args.emit_dir:
                args.emit_dir.mkdir(parents=True, exist_ok=True)
                (args.emit_dir / ("Siblings.kt" if name == "android" else "Siblings.swift")).write_text(code)
            print(name, "fixture constructed; no native compiler/runtime invoked")
    else:
        suite = unittest.TestSuite(NativeSiblingTests("test_" + platform) for platform in ("android", "ios") if args.platform in ("all", platform))
        raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())
