// Hosted macOS acceptance helper. No permission prompts or TCC changes.
// Compile only in the approved hosted job: Swift 5 mode, macOS 14+ SDK.
import AppKit
import ApplicationServices
import Carbon
import CoreGraphics
import ImageIO
import ScreenCaptureKit
import UniformTypeIdentifiers

struct Refusal: Error {
    let code: String
    let detail: String
}
func require(_ yes: Bool, _ code: String, _ detail: String) throws {
    if !yes { throw Refusal(code: code, detail: detail) }
}
let started = ProcessInfo.processInfo.systemUptime
var operationBudget: Double = 25
var currentPhase = "startup"
var lastOperation = "startup"
var traceBytes = 0
var traceUnavailable = false
let traceLimit = 1024 * 1024
// Only fixed operation names, statuses and timing: never AX values or file paths.
@discardableResult
func rawTrace(_ event: String, _ operation: String, status: String = "", details: [String: Any] = [:]) -> Bool {
    guard !traceUnavailable else { return false }
    var record: [String: Any] = ["schema": 1, "event": event, "phase": currentPhase,
        "operation": operation, "status": status,
        "elapsed_ms": Int((ProcessInfo.processInfo.systemUptime - started) * 1000)]
    if !details.isEmpty { record["details"] = details }
    guard var data = try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]) else {
        traceUnavailable = true
        return false
    }
    data.append(0x0a)
    guard traceBytes + data.count <= traceLimit else {
        traceUnavailable = true
        return false
    }
    do { try FileHandle.standardError.write(contentsOf: data) }
    catch { traceUnavailable = true; return false }
    traceBytes += data.count
    traceEvents[event + ":" + operation, default: 0] += 1
    return true
}

var traceEvents: [String: Int] = [:]
let routineAttributes: Set<String> = ["AXChildren", "AXSelectedChildren", "AXSelected", "AXRole", "AXTitle"]
struct ReadStats {
    var calls = 0
    var errors = 0
    var slow = 0
    var maxMilliseconds = 0
    var results: [Int: Int] = [:]
    var firstError: Int?
    var lastError: Int?
    mutating func add(_ result: Int, _ milliseconds: Int) {
        calls += 1
        results[result, default: 0] += 1
        maxMilliseconds = max(maxMilliseconds, milliseconds)
        if milliseconds >= 100 { slow += 1 }
        if result != 0 {
            errors += 1
            if firstError == nil { firstError = result }
            lastError = result
        }
    }
    var json: [String: Any] {
        var value: [String: Any] = ["calls": calls, "errors": errors, "slow": slow,
            "max_ms": maxMilliseconds,
            "results": Dictionary(uniqueKeysWithValues: results.map { (String($0.key), $0.value) })]
        if let firstError { value["first_error"] = firstError }
        if let lastError { value["last_error"] = lastError }
        return value
    }
}
var pendingReads: [String: ReadStats] = [:]
var readTotals: [String: ReadStats] = [:]
var pendingReadCount = 0
var emittedReadCount = 0
var emittedReadErrors = 0
@discardableResult
func flushReads() -> Bool {
    if pendingReadCount == 0 { return !traceUnavailable }
    let details = pendingReads.mapValues { $0.json }
    guard rawTrace("summary", "AX.routineReads", details: ["calls": pendingReadCount, "reads": details]) else { return false }
    emittedReadCount += pendingReadCount
    emittedReadErrors += pendingReads.values.reduce(0) { $0 + $1.errors }
    pendingReads.removeAll(keepingCapacity: true)
    pendingReadCount = 0
    return true
}
@discardableResult
func trace(_ event: String, _ operation: String, status: String = "", details: [String: Any] = [:]) -> Bool {
    guard flushReads() else { return false }
    return rawTrace(event, operation, status: status, details: details)
}
func beginRoutineRead(_ operation: String) -> Bool {
    if pendingReadCount == 0 {
        return rawTrace("begin", "AX.routineReads", details: ["next_operation": operation])
    }
    return !traceUnavailable
}
func recordRoutineRead(_ operation: String, result: Int, milliseconds: Int) {
    pendingReads[operation, default: ReadStats()].add(result, milliseconds)
    readTotals[operation, default: ReadStats()].add(result, milliseconds)
    pendingReadCount += 1
    if milliseconds >= 100 {
        rawTrace("slow", operation, status: String(result), details: ["elapsed_ms": milliseconds])
    }
    // A bounded progress interval, including every result code and all errors.
    if pendingReadCount >= 64 { flushReads() }
}
var walkSequence = 0

func observationAllowed() -> Bool {
    !traceUnavailable && ProcessInfo.processInfo.systemUptime - started < operationBudget
}
func tick() throws {
    try require(!traceUnavailable, "trace_budget", "Progress trace limit or write failure")
    try require(ProcessInfo.processInfo.systemUptime - started < operationBudget,
                "deadline", "Helper's cooperative deadline expired")
}
func phase(_ name: String) throws {
    try tick()
    try require(flushReads(), "trace_budget", "Progress trace unavailable")
    currentPhase = name
    try require(trace("phase", name), "trace_budget", "Progress trace unavailable")
}
func observed<T>(_ operation: String, _ body: () throws -> T) throws -> T {
    try tick()
    lastOperation = operation
    try require(trace("begin", operation), "trace_budget", "Progress trace unavailable")
    do {
        let value = try body()
        try require(trace("end", operation, status: "returned"), "trace_budget", "Progress trace unavailable")
        return value
    } catch {
        trace("end", operation, status: "threw")
        throw error
    }
}
enum PauseMode { case runLoop, polling }
func pause(_ seconds: Double = 0.05, mode: PauseMode = .runLoop) throws {
    switch mode {
    case .runLoop:
        try observed("RunLoop.pause") {
            RunLoop.current.run(until: Date(timeIntervalSinceNow: seconds))
        }
    case .polling:
        try observed("Thread.pollingPause") {
            Thread.sleep(forTimeInterval: seconds)
        }
    }
    try tick()
}
func waitUntil(_ detail: String, seconds: Double = 5, mode: PauseMode = .runLoop, _ body: () throws -> Bool) throws {
    let end = ProcessInfo.processInfo.systemUptime + seconds
    repeat {
        if try body() { return }
        try pause(mode: mode)
    } while ProcessInfo.processInfo.systemUptime < end
    throw Refusal(code: "ui_not_ready", detail: detail)
}
func attr(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    guard observationAllowed() else { return nil }
    let operation = "AXCopy." + name
    lastOperation = operation
    let routine = routineAttributes.contains(name)
    guard (routine ? beginRoutineRead(operation) : trace("begin", operation)) else { return nil }
    let start = ProcessInfo.processInfo.systemUptime
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    let elapsed = max(0, Int((ProcessInfo.processInfo.systemUptime - start) * 1000))
    if routine {
        recordRoutineRead(operation, result: Int(result.rawValue), milliseconds: elapsed)
    } else {
        trace("end", operation, status: String(result.rawValue), details: ["elapsed_ms": elapsed])
    }
    return result == .success ? value : nil
}
func string(_ element: AXUIElement, _ name: String) -> String {
    (attr(element, name) as? String) ?? ""
}
func children(_ element: AXUIElement, _ name: String = "AXChildren") -> [AXUIElement] {
    (attr(element, name) as? [AXUIElement]) ?? []
}
func elementAttr(_ element: AXUIElement, _ name: String) -> AXUIElement? {
    guard let value = attr(element, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return (value as! AXUIElement)
}
func number(_ element: AXUIElement, _ name: String) -> Int? {
    (attr(element, name) as? NSNumber)?.intValue
}
func frame(_ element: AXUIElement) -> CGRect? {
    guard let p = attr(element, "AXPosition"), let s = attr(element, "AXSize"),
          CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID() else { return nil }
    var point = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(p as! AXValue, .cgPoint, &point),
          AXValueGetValue(s as! AXValue, .cgSize, &size),
          point.x.isFinite, point.y.isFinite, size.width.isFinite, size.height.isFinite,
          size.width > 0, size.height > 0 else { return nil }
    return CGRect(origin: point, size: size)
}
func rectJSON(_ rect: CGRect) -> [String: Double] {
    ["x": Double(rect.origin.x), "y": Double(rect.origin.y), "width": Double(rect.width), "height": Double(rect.height)]
}
func walk(_ root: AXUIElement) throws -> [AXUIElement] {
    walkSequence += 1
    let id = walkSequence
    var pending: [(AXUIElement, Int)] = [(root, 0)]
    var result: [AXUIElement] = []
    var depths: [Int] = []
    var seen: [CFHashCode: [Int]] = [:]
    var rawVisits = 0, revisited = 0, comparisons = 0, work = 0
    var depthLimited = 0, truncated = 0, reexpanded = 0, scheduled = 1
    func details(_ outcome: String) -> [String: Any] {
        ["id": id, "outcome": outcome, "raw_visits": rawVisits, "visited": result.count,
         "revisited": revisited, "comparisons": comparisons, "work": work,
         "depth_truncated": depthLimited, "work_truncated": truncated, "reexpanded": reexpanded,
         "candidate_refs": scheduled]
    }
    try require(trace("begin", "AX.walk", details: ["id": id]), "trace_budget", "Walk trace unavailable")
    do {
        while let (node, depth) = pending.popLast() {
            try tick()
            rawVisits += 1
            work += 1
            if work > 1400 { truncated += pending.count + 1 }
            try require(work <= 1400, "ax_tree_limit", "AX tree exceeded 1400 work units")
            let hash = CFHash(node)
            var match: Int?
            for index in seen[hash] ?? [] {
                comparisons += 1
                work += 1
                if work > 1400 { truncated += pending.count + 1 }
                try require(work <= 1400, "ax_tree_limit", "AX identity comparisons exceeded 1400 work units")
                if CFEqual(result[index], node) { match = index; break }
            }
            if let index = match {
                revisited += 1
                if depth >= depths[index] { continue }
                // Preserve DFS ordering but expand a shallower route if the
                // first encounter reached the depth boundary via another path.
                depths[index] = depth
                reexpanded += 1
            } else {
                seen[hash, default: []].append(result.count)
                result.append(node)
                depths.append(depth)
            }
            if depth < 14 {
                let next = children(node)
                if scheduled + next.count > 1400 {
                    truncated += next.count
                    throw Refusal(code: "ax_tree_limit", detail: "AX candidate work exceeded 1400 nodes")
                }
                scheduled += next.count
                for child in next.reversed() { pending.append((child, depth + 1)) }
            } else {
                depthLimited += 1
            }
        }
        try require(trace("end", "AX.walk", details: details("complete")), "trace_budget", "Walk trace unavailable")
        return result
    } catch {
        trace("end", "AX.walk", details: details("failed"))
        throw error
    }
}
func unique(_ root: AXUIElement, role: String, titles: [String]) throws -> AXUIElement {
    let found = try walk(root).filter {
        string($0, "AXRole") == role && titles.contains(string($0, "AXTitle"))
    }
    try require(found.count == 1, "ax_match", "Expected one \(role) named \(titles); found \(found.count)")
    return found[0]
}
func press(_ element: AXUIElement) throws {
    try tick()
    try require(number(element, "AXEnabled") != 0, "ax_disabled", "Control is disabled")
    let result = try observed("AXPress") {
        AXUIElementPerformAction(element, "AXPress" as CFString)
    }
    // CannotComplete may mean a modal action took effect. Never retry it.
    try require(result == .success, "ax_press", "AXPress returned error " + String(result.rawValue))
}
func set(_ element: AXUIElement, _ name: String, _ value: CFTypeRef) throws {
    try tick()
    let result = try observed("AXSet." + name) {
        AXUIElementSetAttributeValue(element, name as CFString, value)
    }
    try require(result == .success, "ax_set", "AXSet returned error " + String(result.rawValue))
}
func ax(_ pid: pid_t) -> AXUIElement {
    let result = AXUIElementCreateApplication(pid)
    AXUIElementSetMessagingTimeout(result, 0.5)
    return result
}
func front(_ app: NSRunningApplication) throws {
    try require(!app.isTerminated, "app_exited", "Target application exited")
    let activated = try observed("NSRunningApplication.activate") {
        app.activate(options: [.activateIgnoringOtherApps])
    }
    try require(activated, "activate", "Cannot activate target")
    try waitUntil("Target did not become frontmost") {
        NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier
    }
}
func key(_ app: NSRunningApplication, _ code: CGKeyCode, flags: CGEventFlags = []) throws {
    try front(app)
    try require(CGPreflightPostEventAccess(), "post_permission", "Synthetic event permission absent")
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true),
          let up = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false) else {
        throw Refusal(code: "event_allocation", detail: "Cannot create key events")
    }
    down.flags = flags
    up.flags = flags
    try observed("CGEvent.keyDownUp") {
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
    }
}
func finderPermission() -> OSStatus {
    let target = NSAppleEventDescriptor(bundleIdentifier: "com.apple.finder")
    return AEDeterminePermissionToAutomateTarget(target.aeDesc, typeWildCard, typeWildCard, false)
}
func finder() throws -> NSRunningApplication {
    let found = try observed("Finder.runningApplications") {
        NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.finder").filter { !$0.isTerminated }
    }
    try require(found.count == 1, "finder_unavailable", "Expected one running Finder")
    return found[0]
}
func prerequisites() throws -> [String: Any] {
    try phase("capabilities")
    let session = try observed("CGSessionCopyCurrentDictionary") {
        CGSessionCopyCurrentDictionary() as? [String: Any]
    }
    let onConsole = session?[kCGSessionOnConsoleKey as String] as? Bool ?? false
    let loggedIn = session?[kCGSessionLoginDoneKey as String] as? Bool ?? false
    let facts: [String: Any] = [
        "accessibility": try observed("AXIsProcessTrusted") { AXIsProcessTrusted() },
        "post_events": try observed("CGPreflightPostEventAccess") { CGPreflightPostEventAccess() },
        "screen_capture": try observed("CGPreflightScreenCaptureAccess") { CGPreflightScreenCaptureAccess() },
        "finder_automation_status": try observed("AEDeterminePermission") { Int(finderPermission()) },
        "on_console": onConsole, "login_complete": loggedIn,
        "display_active": CGDisplayIsActive(CGMainDisplayID()) != 0,
        "os": ProcessInfo.processInfo.operatingSystemVersionString
    ]
    for name in ["accessibility", "post_events", "screen_capture", "on_console", "login_complete", "display_active"] {
        try require(facts[name] as? Bool == true, "preflight_" + name, "Required capability absent: " + name)
    }
    // AppleEvent authorization is telemetry only; no AppleEvents are sent.
    let app = try finder()
    try require(elementAttr(ax(app.processIdentifier), "AXMenuBar") != nil,
                "finder_ax", "Finder AX menu bar unavailable")
    return facts
}
func safeURL(_ text: String) throws -> URL {
    try require(text.hasPrefix("/") && text.utf8.count <= 4096 && !text.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }),
                "path", "Expected bounded absolute path without control characters")
    let url = URL(fileURLWithPath: text).standardizedFileURL
    try require(url.path == url.resolvingSymlinksInPath().path, "symlink_path", "Fixture and app paths must be canonical, without symlink aliases")
    return url
}
struct Target {
    let url: URL
    let bundleID: String
    init(_ path: String) throws {
        url = try safeURL(path)
        guard url.pathExtension == "app", let bundle = Bundle(url: url),
              let id = bundle.bundleIdentifier, !id.isEmpty,
              let executable = bundle.executableURL, FileManager.default.isExecutableFile(atPath: executable.path),
              id != "com.apple.finder" else {
            throw Refusal(code: "app_bundle", detail: "Expected executable QA application bundle")
        }
        bundleID = id
    }
    func running() throws -> [NSRunningApplication] {
        let all = try observed("Target.runningApplications") {
            NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).filter { !$0.isTerminated }
        }
        try require(all.allSatisfy { $0.bundleURL?.resolvingSymlinksInPath().path == url.path },
                    "bundle_collision", "Another application path uses the QA bundle identifier")
        try require(all.count <= 1, "instance_collision", "Multiple target application instances")
        return all
    }
    func one() throws -> NSRunningApplication {
        let found = try running()
        try require(found.count == 1, "target_not_running", "QA application is not running")
        return found[0]
    }
    func json(_ app: NSRunningApplication) -> [String: Any] {
        ["pid": Int(app.processIdentifier), "bundle_id": bundleID, "path": url.path]
    }
}
func fixture(_ path: String) throws -> URL {
    let url = try safeURL(path)
    let facts = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
    try require(facts.isRegularFile == true && facts.isSymbolicLink != true && (facts.fileSize ?? 0) > 0,
                "fixture_file", "Expected a nonempty regular file")
    return url
}
func window(_ app: NSRunningApplication) throws -> AXUIElement {
    let root = ax(app.processIdentifier)
    let windows = children(root, "AXWindows").filter { string($0, "AXRole") == "AXWindow" && frame($0) != nil }
    try require(windows.count == 1, "window_ambiguity", "Expected exactly one target window")
    return windows[0]
}
// Last bounded observation is retained on both success and refusal.
// The source query contains on-screen windows only; absence says nothing about off-screen windows.
var nativeWindowEvidence: [String: Any]?
func contentWindow(_ record: [String: Any]) -> Bool {
    (record[kCGWindowLayer as String] as? NSNumber)?.intValue == 0 &&
    (((record[kCGWindowBounds as String] as? [String: Any])?["Width"] as? NSNumber)?.doubleValue ?? 0) > 100
}
func windowCandidates(_ app: NSRunningApplication, sample: Int) throws -> [[String: Any]] {
    var evidence: [String: Any] = ["owner_pid": Int(app.processIdentifier), "sample": sample,
        "observed_ms": Int((ProcessInfo.processInfo.systemUptime - started) * 1000),
        "scope": "owned_on_screen_windows", "query_performed": false]
    nativeWindowEvidence = evidence
    let queried = try observed("CGWindowListCopyWindowInfo") {
        CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]
    }
    guard let all = queried else {
        evidence["query_error"] = "enumeration_unavailable"
        nativeWindowEvidence = evidence
        trace("summary", "NativeWindow.observation", details: evidence)
        throw Refusal(code: "windows", detail: "WindowServer enumeration unavailable")
    }
    let owned = all.filter { ($0[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == app.processIdentifier }
    let found = owned.filter(contentWindow)
    let rows = owned.prefix(16).map { record -> [String: Any] in
        var row: [String: Any] = ["on_screen": true, "candidate": contentWindow(record)]
        for (name, key) in [("window_id", kCGWindowNumber as String), ("layer", kCGWindowLayer as String), ("alpha", kCGWindowAlpha as String)] {
            if let number = record[key] as? NSNumber, number.doubleValue.isFinite { row[name] = number }
        }
        if let bounds = record[kCGWindowBounds as String] as? [String: Any] {
            for (name, key) in [("x", "X"), ("y", "Y"), ("width", "Width"), ("height", "Height")] {
                if let number = bounds[key] as? NSNumber, number.doubleValue.isFinite { row[name] = number }
            }
        }
        return row
    }
    evidence["query_performed"] = true
    evidence["owned_count"] = owned.count
    evidence["candidate_count"] = found.count
    evidence["records"] = rows
    evidence["records_truncated"] = owned.count - rows.count
    if found.count == 1 { evidence["selected_id"] = found[0][kCGWindowNumber as String] }
    nativeWindowEvidence = evidence
    try require(trace("summary", "NativeWindow.observation", details: evidence),
                "trace_budget", "Native window evidence unavailable")
    return found
}
func windowRecord(_ app: NSRunningApplication) throws -> [String: Any] {
    let found = try windowCandidates(app, sample: 1)
    try require(!found.isEmpty, "native_window_not_ready", "No on-screen target content window")
    try require(found.count == 1, "native_window_ambiguity", "Multiple on-screen target content windows")
    return found[0]
}
func readyWindowRecord(_ target: Target, app: NSRunningApplication, expectedPID: pid_t) throws -> [String: Any] {
    let end = ProcessInfo.processInfo.systemUptime + 5
    var sample = 0
    repeat {
        try tick()
        try require(ProcessInfo.processInfo.systemUptime < end, "native_window_not_ready",
                    "No on-screen target content window within five seconds")
        let current = try target.one()
        try require(current.processIdentifier == expectedPID && app.processIdentifier == expectedPID && !app.isTerminated,
                    "screen_owner", "Action's original QA process exited or changed before capture")
        sample += 1
        let found = try windowCandidates(app, sample: sample)
        try require(found.count <= 1, "native_window_ambiguity", "Multiple on-screen target content windows")
        let remaining = end - ProcessInfo.processInfo.systemUptime
        try require(remaining > 0, "native_window_not_ready", "No on-screen target content window within five seconds")
        if let record = found.first { return record }
        // Only zero candidates wait. Pump lifecycle events first, then fill an early
        // RunLoop return with bounded sleep so full observations cannot busy-loop.
        let nextSample = min(end, ProcessInfo.processInfo.systemUptime + 0.05)
        let wake = min(nextSample, started + operationBudget)
        let runLoopWait = wake - ProcessInfo.processInfo.systemUptime
        if runLoopWait > 0 { try pause(runLoopWait) }
        let residual = wake - ProcessInfo.processInfo.systemUptime
        if residual > 0 { try pause(residual, mode: .polling) }
        try tick()
    } while true
}
func selectedFileElements(_ root: AXUIElement, file: URL) throws -> [AXUIElement] {
    let nodes = try walk(root)
    let selected = nodes.flatMap { children($0, "AXSelectedChildren") } + nodes.filter { number($0, "AXSelected") == 1 }
    try require(selected.count <= 16, "finder_selection", "Selection is not bounded to one fixture")
    var found: [AXUIElement] = []
    for node in selected {
        for child in try walk(node) where selectedURL(child)?.standardizedFileURL.path == file.path {
            if !found.contains(where: { CFEqual($0, child) }) { found.append(child) }
        }
    }
    try require(trace("selection", "Finder.selectedFileElements",
                      status: "nodes=\(nodes.count);selected=\(selected.count);matches=\(found.count)"),
                "trace_budget", "Selection trace unavailable")
    return found
}
func reveal(_ file: URL) throws -> NSRunningApplication {
    let app = try finder()
    // Public Finder reveal, followed by exact AX URL proof. No AppleScript or
    // basename-only fallback: a missing accessibility URL is a refusal.
    try observed("NSWorkspace.activateFileViewerSelecting") {
        NSWorkspace.shared.activateFileViewerSelecting([file])
    }
    try front(app)
    // These observations address Finder directly through AX. Do not pump
    // unrelated AppKit callbacks between selection polls. Lifecycle and
    // ScreenCaptureKit waits retain the main-run-loop mode.
    try waitUntil("Finder does not expose the exact selected fixture URL", mode: .polling) {
        try require(try finder().processIdentifier == app.processIdentifier, "finder_changed", "Finder changed during reveal")
        return try !selectedFileElements(ax(app.processIdentifier), file: file).isEmpty
    }
    return app
}
func selectedURL(_ node: AXUIElement) -> URL? {
    guard let value = attr(node, "AXURL") else { return nil }
    if let url = value as? URL, url.isFileURL { return url }
    if let text = value as? String, let url = URL(string: text), url.isFileURL { return url }
    return nil
}
func chooserSelection(_ root: AXUIElement, target: URL) throws -> AXUIElement? {
    let nodes = try walk(root)
    // AXURL is required: a basename alone cannot prove the chosen bundle path.
    return nodes.first {
        number($0, "AXSelected") == 1 && selectedURL($0)?.standardizedFileURL.path == target.path
    }
}
func finderOpen(_ target: Target, file: URL) throws -> [String: Any] {
    try phase("finder_open_identity")
    let before = try target.running().first?.processIdentifier
    try phase("finder_reveal")
    let app = try reveal(file)
    let root = ax(app.processIdentifier)
    guard let menu = elementAttr(root, "AXMenuBar") else { throw Refusal(code: "menu", detail: "No Finder menu bar") }
    try phase("finder_file_menu")
    let fileMenu = try unique(menu, role: "AXMenuBarItem", titles: ["File"])
    try press(fileMenu)
    var openWith: AXUIElement?
    try waitUntil("Finder File menu has no Open With") {
        openWith = try walk(fileMenu).first { string($0, "AXRole") == "AXMenuItem" && string($0, "AXTitle") == "Open With" }
        return openWith != nil
    }
    try phase("finder_open_with")
    try press(openWith!)
    var other: AXUIElement?
    try waitUntil("Finder Open With has no Other item") {
        other = try walk(openWith!).first { string($0, "AXRole") == "AXMenuItem" && ["Other…", "Other..."].contains(string($0, "AXTitle")) }
        return other != nil
    }
    try phase("finder_other")
    try press(other!)
    try waitUntil("Finder application chooser absent") {
        try walk(root).contains { string($0, "AXRole") == "AXButton" && string($0, "AXTitle") == "Open" }
    }
    try phase("chooser_go_to_folder")
    try key(app, 5, flags: [.maskCommand, .maskShift]) // Go to Folder, not an Open With substitute.
    var field: AXUIElement?
    try waitUntil("Go to Folder text field absent") {
        guard let focused = elementAttr(root, "AXFocusedUIElement"),
              ["AXTextField", "AXComboBox"].contains(string(focused, "AXRole")) else { return false }
        field = focused
        return true
    }
    try phase("chooser_exact_path")
    try set(field!, "AXValue", target.url.path as CFString)
    try require(string(field!, "AXValue") == target.url.path, "chooser_path", "Go to Folder did not retain exact bundle path")
    try key(app, 36)
    try waitUntil("Application chooser cannot attest exact selected QA bundle URL") {
        try chooserSelection(root, target: target.url) != nil
    }
    try phase("chooser_verify_selection_and_default")
    let boxes = try walk(root).filter { string($0, "AXRole") == "AXCheckBox" && string($0, "AXTitle") == "Always Open With" }
    try require(boxes.count == 1, "default_checkbox", "Cannot locate exactly one Always Open With checkbox")
    try require(number(boxes[0], "AXValue") == 0, "default_checkbox", "Always Open With is selected or unreadable; refusing to change defaults")
    let open = try unique(root, role: "AXButton", titles: ["Open"])
    try require(try chooserSelection(root, target: target.url) != nil, "chooser_changed", "Selected application changed before Open")
    try phase("chooser_open")
    try press(open)
    try phase("target_arrival")
    var running: NSRunningApplication?
    try waitUntil("Exact QA bundle did not receive Finder Open With", seconds: 8) {
        running = try target.running().first
        return running != nil && NSWorkspace.shared.frontmostApplication?.processIdentifier == running?.processIdentifier
    }
    if let before { try require(running!.processIdentifier == before, "warm_pid_changed", "Warm Open With changed target PID") }
    var result = target.json(running!)
    result["route"] = "finder_file_open_with_other"
    result["selected_file"] = file.path
    result["selected_application"] = target.url.path
    result["default_checkbox"] = false
    result["was_running"] = before != nil
    result["delivery_only"] = true
    return result
}
func moveWindow(_ win: AXUIElement, rect: CGRect) throws {
    var origin = rect.origin
    var size = rect.size
    guard let p = AXValueCreate(.cgPoint, &origin), let s = AXValueCreate(.cgSize, &size) else { throw Refusal(code: "geometry", detail: "Cannot create AX geometry") }
    try set(win, "AXPosition", p)
    try set(win, "AXSize", s)
}
func hitPID(_ point: CGPoint) -> pid_t? {
    var hit: AXUIElement?
    guard AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(), Float(point.x), Float(point.y), &hit) == .success,
          let hit else { return nil }
    var pid: pid_t = 0
    return AXUIElementGetPid(hit, &pid) == .success ? pid : nil
}
func mouse(_ type: CGEventType, _ point: CGPoint) throws {
    try tick()
    guard let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left) else {
        throw Refusal(code: "event_allocation", detail: "Cannot create pointer event")
    }
    event.setIntegerValueField(.mouseEventClickState, value: 1)
    event.post(tap: .cghidEventTap)
}
func finderDrop(_ target: Target, file: URL) throws -> [String: Any] {
    let app = try target.one()
    try front(app)
    let qaWindow = try window(app)
    let finderApp = try reveal(file)
    let finderWindow = try window(finderApp)
    let display = CGDisplayBounds(CGMainDisplayID())
    try require(display.width >= 1100 && display.height >= 650, "display_size", "Display is too small for two independently visible windows")
    let margin: CGFloat = 24
    let width = (display.width - margin * 3) / 2
    try moveWindow(finderWindow, rect: CGRect(x: display.minX + margin, y: display.minY + 70, width: width, height: display.height - 110))
    try moveWindow(qaWindow, rect: CGRect(x: display.minX + width + margin * 2, y: display.minY + 70, width: width, height: display.height - 110))
    try front(finderApp)
    let root = ax(finderApp.processIdentifier)
    try waitUntil("Finder selection moved during window arrangement") { try !selectedFileElements(root, file: file).isEmpty }
    let selected = try selectedFileElements(root, file: file)
    let candidates = selected.compactMap { node -> (AXUIElement, CGRect)? in
        guard let rect = frame(node), rect.width >= 8, rect.height >= 8,
              ["AXRow", "AXCell", "AXImage", "AXButton", "AXTextField"].contains(string(node, "AXRole")) else { return nil }
        return (node, rect)
    }.sorted { $0.1.width * $0.1.height < $1.1.width * $1.1.height }
    guard let source = candidates.first else { throw Refusal(code: "drag_source", detail: "Finder exposes no selected file geometry") }
    let webs = try walk(qaWindow).filter { string($0, "AXRole") == "AXWebArea" && frame($0) != nil }
    try require(webs.count == 1, "drag_target", "Expected one QA web content area")
    let destination = frame(webs[0])!
    let from = CGPoint(x: source.1.midX, y: source.1.midY)
    let to = CGPoint(x: destination.midX, y: destination.midY)
    try require(display.contains(from) && display.contains(to), "drag_coordinates", "Drag point outside display")
    try require(hitPID(from) == finderApp.processIdentifier && hitPID(to) == app.processIdentifier,
                "drag_occluded", "Exact Finder source or QA destination is covered")
    try require(try target.one().processIdentifier == app.processIdentifier, "target_changed", "QA target changed before drag")
    try require(CGPreflightPostEventAccess(), "post_permission", "Pointer event permission absent")
    try mouse(.mouseMoved, from)
    try mouse(.leftMouseDown, from)
    // Always release the button, including deadline/refusal during motion.
    var buttonDown = true
    var lastPoint = from
    defer { if buttonDown, let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: lastPoint, mouseButton: .left) { up.post(tap: .cghidEventTap) } }
    try pause(0.15)
    for index in 1...24 {
        let t = CGFloat(index) / 24
        lastPoint = CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t)
        try mouse(.leftMouseDragged, lastPoint)
        try pause(0.025)
    }
    try mouse(.leftMouseUp, to)
    buttonDown = false
    var result = target.json(app)
    result["route"] = "finder_selected_file_cgevent_drag"
    result["selected_file"] = file.path
    result["source_pid"] = Int(finderApp.processIdentifier)
    result["source_point"] = ["x": from.x, "y": from.y]
    result["target_point"] = ["x": to.x, "y": to.y]
    result["delivery_only"] = true
    return result
}
final class ResultBox<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var result: Result<Value, Error>?
    func put(_ value: Result<Value, Error>) { lock.lock(); result = value; lock.unlock() }
    func get() -> Result<Value, Error>? { lock.lock(); defer { lock.unlock() }; return result }
}
func awaitResult<Value>(_ box: ResultBox<Value>) throws -> Value {
    try waitUntil("Asynchronous platform operation timed out", seconds: 8) { box.get() != nil }
    return try box.get()!.get()
}
@available(macOS 14.0, *)
func screenshot(_ target: Target, output: String, expectedPID: pid_t) throws -> [String: Any] {
    try require(expectedPID > 0, "screen_owner", "Expected a positive action PID")
    nativeWindowEvidence = ["owner_pid": Int(expectedPID), "query_performed": false]
    let app = try target.one()
    try require(app.processIdentifier == expectedPID, "screen_owner", "Action PID changed before screenshot")
    try phase("native_window_readiness")
    let record = try readyWindowRecord(target, app: app, expectedPID: expectedPID)
    let id = (record[kCGWindowNumber as String] as! NSNumber).uint32Value
    let destination = try safeURL(output)
    try require(destination.pathExtension.lowercased() == "png" && !FileManager.default.fileExists(atPath: destination.path), "screenshot_path", "Output must be a new PNG path")
    let contentBox = ResultBox<SCShareableContent>()
    SCShareableContent.getExcludingDesktopWindows(true, onScreenWindowsOnly: true) { content, error in
        if let content { contentBox.put(.success(content)) }
        else { contentBox.put(.failure(error ?? Refusal(code: "screen_content", detail: "No shareable content"))) }
    }
    let content = try awaitResult(contentBox)
    guard let win = content.windows.first(where: { $0.windowID == id && $0.owningApplication?.processID == app.processIdentifier }) else {
        throw Refusal(code: "screen_owner", detail: "Exact native window is no longer shareable")
    }
    try require(win.frame.width > 0 && win.frame.height > 0 && win.frame.width <= 4096 && win.frame.height <= 4096,
                "capture_size", "Target window exceeds bounded screenshot dimensions")
    let filter = SCContentFilter(desktopIndependentWindow: win)
    let config = SCStreamConfiguration()
    config.width = Int(win.frame.width.rounded(.up))
    config.height = Int(win.frame.height.rounded(.up))
    config.showsCursor = false
    try require(try target.one().processIdentifier == expectedPID && !app.isTerminated,
                "screen_owner", "Action PID changed before image capture")
    let imageBox = ResultBox<CGImage>()
    SCScreenshotManager.captureImage(contentFilter: filter, configuration: config) { image, error in
        if let image { imageBox.put(.success(image)) }
        else { imageBox.put(.failure(error ?? Refusal(code: "screenshot", detail: "No captured image"))) }
    }
    let image = try awaitResult(imageBox)
    try require(try target.one().processIdentifier == expectedPID && !app.isTerminated, "screen_owner", "QA exited or changed during capture")
    guard let sink = CGImageDestinationCreateWithURL(destination as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw Refusal(code: "png_output", detail: "Cannot create PNG output")
    }
    CGImageDestinationAddImage(sink, image, nil)
    try require(CGImageDestinationFinalize(sink), "png_output", "PNG encoding failed")
    var result = target.json(app)
    result["window_id"] = id
    result["png"] = destination.path
    result["width"] = image.width
    result["height"] = image.height
    result["scope"] = "Window screenshot, not decoded-frame or audible-output evidence"
    return result
}
func snapshot(_ target: Target) throws -> [String: Any] {
    let app = try target.one()
    let win = try window(app)
    let nodes = try walk(win).map { node -> [String: Any] in
        let role = string(node, "AXRole")
        var item: [String: Any] = ["role": role, "title": String(string(node, "AXTitle").prefix(256))]
        if let rect = frame(node) { item["frame"] = rectJSON(rect) }
        // Never include secure fields; the isolated fixture may contain only synthetic metadata.
        if string(node, "AXSubrole") != "AXSecureTextField" {
            if let value = attr(node, "AXValue") as? String { item["value"] = String(value.prefix(256)) }
        }
        return item
    }
    let record = try windowRecord(app)
    var result = target.json(app)
    result["window_id"] = record[kCGWindowNumber as String]
    result["nodes"] = nodes
    return result
}
func launchServicesOpen(_ target: Target, file: URL) throws -> [String: Any] {
    let box = ResultBox<NSRunningApplication>()
    let config = NSWorkspace.OpenConfiguration()
    config.createsNewApplicationInstance = false
    NSWorkspace.shared.open([file], withApplicationAt: target.url, configuration: config) { app, error in
        if let app { box.put(.success(app)) }
        else { box.put(.failure(error ?? Refusal(code: "launchservices", detail: "Explicit open failed"))) }
    }
    let app = try awaitResult(box)
    try require(try target.one().processIdentifier == app.processIdentifier, "launch_owner", "Opened application identity differs")
    var result = target.json(app)
    result["route"] = "launchservices_explicit_application_not_finder"
    result["selected_file"] = file.path
    result["delivery_only"] = true
    return result
}
// A separate child can obtain partial, read-only Finder state after an uncertain
// action. It never activates Finder, reveals a file, presses, types or retries.
func finderDiagnostic() throws -> [String: Any] {
    try phase("finder_diagnostic")
    let trusted = try observed("AXIsProcessTrusted") { AXIsProcessTrusted() }
    try require(trusted, "diagnostic_accessibility", "Finder diagnostic requires existing AX access")
    let app = try finder()
    var pending: [(AXUIElement, Int)] = [(ax(app.processIdentifier), 0)]
    var nodes: [[String: Any]] = []
    var truncated = false
    while !pending.isEmpty && nodes.count < 128 && observationAllowed() {
        let (node, depth) = pending.removeLast()
        var row: [String: Any] = ["depth": depth,
            "role": String(decoding: string(node, "AXRole").utf8.prefix(64), as: UTF8.self),
            "title": String(decoding: string(node, "AXTitle").utf8.prefix(192), as: UTF8.self)]
        if let rect = frame(node) { row["frame"] = rectJSON(rect) }
        if let enabled = number(node, "AXEnabled") { row["enabled"] = enabled }
        if let selected = number(node, "AXSelected") { row["selected"] = selected }
        nodes.append(row)
        if depth < 6 {
            let nested = children(node)
            let room = max(0, 128 - nodes.count - pending.count)
            if nested.count > room { truncated = true }
            for child in nested.prefix(room).reversed() { pending.append((child, depth + 1)) }
        } else { truncated = true }
    }
    return ["pid": Int(app.processIdentifier), "bundle_id": "com.apple.finder",
        "nodes": nodes, "traversal_exhausted": !truncated && pending.isEmpty && observationAllowed(),
        "deadline_reached": ProcessInfo.processInfo.systemUptime - started >= operationBudget,
        "trace_unavailable": traceUnavailable,
        "scope": "Read-only partial Finder AX state; unavailable attributes may be absent even when traversal is exhausted; no delivery or playback conclusion"]
}


func traceContract() throws -> [String: Any] {
    try phase("trace_contract")
    let operations = routineAttributes.sorted().map { "AXCopy." + $0 }
    for index in 0..<20000 {
        try tick()
        let operation = operations[index % operations.count]
        try require(beginRoutineRead(operation), "trace_contract", "Cannot begin synthetic routine read")
        recordRoutineRead(operation, result: index % 257 == 0 ? -25204 : 0,
                          milliseconds: index % 1000 == 0 ? 150 : 1)
    }
    // These use the same critical-event path as real mutations and flush all
    // preceding routine counts into the actual bounded stderr stream.
    try require(trace("begin", "TraceContract.critical"), "trace_contract", "Missing critical begin")
    try require(trace("end", "TraceContract.critical", status: "returned"), "trace_contract", "Missing critical end")
    let total = readTotals.values.reduce(0) { $0 + $1.calls }
    let errors = readTotals.values.reduce(0) { $0 + $1.errors }
    let slow = readTotals.values.reduce(0) { $0 + $1.slow }
    let codes = readTotals.values.reduce(0) { $0 + ($1.results[-25204] ?? 0) }
    try require(total == 20000 && emittedReadCount == total, "trace_contract", "Routine read counts were lost")
    try require(errors == 78 && codes == errors && emittedReadErrors == errors,
                "trace_contract", "Routine errors were lost")
    try require(slow == 20 && traceEvents.filter { $0.key.hasPrefix("slow:AXCopy.") }.values.reduce(0, +) == slow,
                "trace_contract", "Slow read evidence was lost")
    try require(traceEvents["begin:TraceContract.critical"] == 1 && traceEvents["end:TraceContract.critical"] == 1,
                "trace_contract", "Critical event pair was lost")
    try require(traceBytes <= 512 * 1024 && !traceUnavailable, "trace_contract", "Routine tracing exceeded its regression bound")
    return ["routine_reads": total, "routine_errors": errors, "slow_reads": slow,
            "critical_events": 2, "trace_bytes": traceBytes, "trace_limit": traceLimit,
            "scope": "Synthetic trace emitter contract only; no AX calls, GUI action or playback evidence"]
}

func main(_ args: [String]) throws -> [String: Any] {
    try require(!args.isEmpty, "usage", "Expected an action")
    if args[0] == "preflight" {
        try require(args.count == 1, "usage", "preflight takes no arguments")
        return ["capabilities": try prerequisites()]
    }
    if args[0] == "finder-diagnostic" {
        try require(args.count == 1, "usage", "finder-diagnostic takes no arguments")
        return try finderDiagnostic()
    }
    if args[0] == "finder-reveal" {
        try require(args.count == 2, "usage", "finder-reveal FILE")
        _ = try prerequisites()
        let file = try fixture(args[1])
        try phase("finder_reveal")
        let app = try reveal(file)
        return ["selected_file": file.path, "route": "finder_reveal_exact_selection",
                "source_pid": Int(app.processIdentifier)]
    }
    if args[0] == "handler" {
        try require(args.count == 2, "usage", "handler FILE")
        let file = try fixture(args[1])
        let selected = NSWorkspace.shared.urlForApplication(toOpen: file)?.resolvingSymlinksInPath().path
        return ["file": file.path, "application_path": selected as Any? ?? NSNull()]
    }
    try require(args.count >= 2, "usage", "Action requires absolute QA app path")
    try phase("target_resolve")
    let target = try observed("Target.bundle") { try Target(args[1]) }
    if args[0] == "apps" {
        try require(args.count == 2, "usage", "apps APP")
        return ["apps": try target.running().map { target.json($0) }]
    }
    if args[0] == "quit" {
        try require(args.count == 2, "usage", "quit APP")
        guard let app = try target.running().first else { return ["apps": [], "already_stopped": true] }
        let result = target.json(app)
        try require(app.terminate(), "quit_refused", "Exact QA app refused graceful termination")
        try waitUntil("Exact QA app did not exit", seconds: 8) { app.isTerminated }
        return result
    }
    _ = try prerequisites()
    switch args[0] {
    case "snapshot":
        try require(args.count == 2, "usage", "snapshot APP")
        return try snapshot(target)
    case "screenshot":
        try require(args.count == 4, "usage", "screenshot APP OUTPUT.png EXPECTED_PID")
        guard let expectedPID = Int32(args[3]), expectedPID > 0 else {
            throw Refusal(code: "screen_owner", detail: "Expected a positive action PID")
        }
        if #available(macOS 14.0, *) { return try screenshot(target, output: args[2], expectedPID: expectedPID) }
        throw Refusal(code: "macos_version", detail: "Screenshot requires macOS 14+")
    case "finder-open", "finder-drop", "open":
        try require(args.count == 3, "usage", "ACTION APP FILE")
        let file = try fixture(args[2])
        if args[0] == "finder-open" { return try finderOpen(target, file: file) }
        if args[0] == "finder-drop" { return try finderDrop(target, file: file) }
        return try launchServicesOpen(target, file: file)
    default:
        throw Refusal(code: "usage", detail: "Unknown action")
    }
}
let args = Array(CommandLine.arguments.dropFirst())
if args.first == "finder-diagnostic" { operationBudget = 6 }
var output: [String: Any] = ["schema": 1, "action": args.first ?? ""]
var status: Int32 = 0
do {
    guard #available(macOS 14.0, *) else { throw Refusal(code: "macos_version", detail: "Helper requires macOS 14+") }
    if args.first == "trace-contract" {
        try require(args.count == 1, "usage", "trace-contract takes no arguments")
        output.merge(try traceContract()) { _, fresh in fresh }
    } else {
        try phase("initialize")
        // Per-element timeouts do not propagate to descendant or equal AX objects.
        // This checked setting covers all AX messaging in this helper process only.
        let timeout = try observed("AXGlobalMessagingTimeout") {
            AXUIElementSetMessagingTimeout(AXUIElementCreateSystemWide(), 0.5)
        }
        try require(timeout == .success, "ax_timeout", "Cannot set process-wide AX messaging timeout")
        try observed("NSApplication.shared") { _ = NSApplication.shared }
        try observed("NSApplication.activationPolicy") { _ = NSApp.setActivationPolicy(.prohibited) }
        output.merge(try main(args)) { _, fresh in fresh }
    }
    try require(flushReads(), "trace_budget", "Final routine trace unavailable")
    // Diagnostic partial results explicitly report their own smaller deadline.
    if args.first != "finder-diagnostic" { try tick() }
    output["status"] = "ok"
} catch let refusal as Refusal {
    output["status"] = "refused"
    output["error"] = ["code": refusal.code, "detail": refusal.detail]
    status = 2
} catch {
    output["status"] = "refused"
    output["error"] = ["code": "platform_error", "detail": String(describing: type(of: error))]
    status = 2
}
// Preserve the primary refusal even if its final read summary cannot be written.
if status != 0 { _ = flushReads() }
if let evidence = nativeWindowEvidence { output["native_window"] = evidence }
output["phase"] = currentPhase
output["last_operation"] = lastOperation
output["deadline_exceeded"] = ProcessInfo.processInfo.systemUptime - started >= operationBudget
output["trace_unavailable"] = traceUnavailable
output["elapsed_ms"] = Int((ProcessInfo.processInfo.systemUptime - started) * 1000)
if let data = try? JSONSerialization.data(withJSONObject: output, options: [.sortedKeys]),
   let text = String(data: data, encoding: .utf8) { print(text) }
else { print("{\"schema\":1,\"status\":\"refused\",\"error\":{\"code\":\"json\"}}"); status = 2 }
exit(status)
