// Permission probe only. Run in the approved disposable macOS hosted job.
// No request-access API, TCC edit, application launch or input event is used.
import AppKit
import ApplicationServices
import Carbon
import CoreGraphics

_ = NSApplication.shared
NSApp.setActivationPolicy(.prohibited)
let args = Array(CommandLine.arguments.dropFirst())
var facts: [String: Any] = [:]
var missing: [String] = []
func record(_ name: String, _ value: Bool) {
    facts[name] = value
    if !value { missing.append(name) }
}
record("usage", args == ["preflight"])
if #available(macOS 14.0, *) { record("macos_14_or_later", true) }
else { record("macos_14_or_later", false) }
let accessible = AXIsProcessTrusted()
record("accessibility", accessible)
record("post_events", CGPreflightPostEventAccess())
record("screen_capture", CGPreflightScreenCaptureAccess())
let session = CGSessionCopyCurrentDictionary() as? [String: Any]
record("on_console", session?[kCGSessionOnConsoleKey as String] as? Bool ?? false)
record("login_complete", session?[kCGSessionLoginDoneKey as String] as? Bool ?? false)
record("display_active", CGDisplayIsActive(CGMainDisplayID()) != 0)
let finders = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.finder").filter { !$0.isTerminated }
record("finder_running", finders.count == 1)
let target = NSAppleEventDescriptor(bundleIdentifier: "com.apple.finder")
let permission = AEDeterminePermissionToAutomateTarget(target.aeDesc, typeWildCard, typeWildCard, false)
facts["finder_automation_status"] = Int(permission)
facts["finder_automation"] = permission == noErr // telemetry only: no AppleEvents are sent
var readable = false
if accessible, let finder = finders.first, finders.count == 1 {
    let element = AXUIElementCreateApplication(finder.processIdentifier)
    AXUIElementSetMessagingTimeout(element, 0.5)
    var menu: CFTypeRef?
    readable = AXUIElementCopyAttributeValue(element, "AXMenuBar" as CFString, &menu) == .success && menu != nil
    facts["finder_pid"] = Int(finder.processIdentifier)
}
record("finder_ax_menu", readable)
facts["os"] = ProcessInfo.processInfo.operatingSystemVersionString
let result: [String: Any] = ["schema": 1, "action": "preflight", "status": missing.isEmpty ? "ok" : "refused",
                            "capabilities": facts, "missing": missing,
                            "scope": "Permission observations and Finder AX menu only; no AppleEvent, input delivery or playback proved"]
do {
    let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
} catch {
    print("{\"schema\":1,\"action\":\"preflight\",\"status\":\"refused\",\"missing\":[\"json\"]}")
    exit(2)
}
exit(missing.isEmpty ? 0 : 2)
