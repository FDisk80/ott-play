import Capacitor
import CryptoKit
import Foundation
import UIKit
import UniformTypeIdentifiers

// Results cross the worker boundary; all source/index/progress mutation remains
// on the existing serial queue. No cancelled generation releases its four slots
// until all admitted synchronous operations have returned.
private struct LocalMediaDiscoveryJob<Value> {
    let metadata: Bool
    let ready: Bool
    let operation: () throws -> Value
    init(metadata: Bool = false, ready: Bool = false, _ operation: @escaping () throws -> Value) {
        self.metadata = metadata; self.ready = ready; self.operation = operation
    }
}
private final class LocalMediaDiscoveryResults<Value> {
    let ready = NSCondition()
    var values: [(Bool, Result<Value, Error>)] = []
}

/// New selections retain document bookmarks, not media copies. Legacy imports stay readable.
/// Security-scoped access remains active while WebKit can request the playback URL.
@objc(LocalMedia)
public class LocalMedia: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "LocalMediaPlugin"
    public let jsName = "LocalMedia"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sources", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelList", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeSource", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
    ]
    private let listLock = NSLock()
    private var listWork: [String: NativeWork.Ticket] = [:]
    private var currentWork: NativeWork.Ticket?
    private var removeStandbyObserver: (() -> Void)?
    private func tracked(_ call: CAPPluginCall, requestId: String? = nil, _ action: @escaping () -> Void) {
        guard let ticket = NativeWork.shared.begin() else { call.reject("Player is in standby", "standby"); return }
        if let requestId {
            listLock.lock(); let previous = listWork.updateValue(ticket, forKey: requestId); listLock.unlock()
            previous?.cancelWork()
        }
        queue.async {
            self.currentWork = ticket
            defer {
                self.currentWork = nil
                if let requestId {
                    self.listLock.lock()
                    if self.listWork[requestId] === ticket { self.listWork[requestId] = nil }
                    self.listLock.unlock()
                }
                ticket.finish()
            }
            do { try ticket.check(); action() }
            catch { call.reject("Local media request cancelled") }
        }
    }
    private func checkWork() throws { try currentWork?.check() }
    private let queue = DispatchQueue(label: "ott.offline-media", qos: .userInitiated)
    private let discoveryQueue = DispatchQueue(label: "ott.offline-media.discovery", qos: .userInitiated, attributes: .concurrent)
    private func discover<Value>(_ initial: [LocalMediaDiscoveryJob<Value>],
                                 consume: (Value) throws -> [LocalMediaDiscoveryJob<Value>]) throws {
        let results = LocalMediaDiscoveryResults<Value>()
        var pending: [LocalMediaDiscoveryJob<Value>?] = []
        var ready: [LocalMediaDiscoveryJob<Value>] = []
        var head = 0
        var running = 0
        var metadataRunning = 0
        var failure: Error?
        var operationFailure: Error?
        func enqueue(_ jobs: [LocalMediaDiscoveryJob<Value>]) {
            // Preserve the producer's order within a ready group while giving
            // its child/probe priority over unrelated queued parent iterators.
            ready.append(contentsOf: jobs.filter { $0.ready }.reversed())
            pending.append(contentsOf: jobs.filter { !$0.ready }.map { Optional($0) })
        }
        func take() -> LocalMediaDiscoveryJob<Value>? {
            if let index = ready.indices.reversed().first(where: { !ready[$0].metadata || metadataRunning < 3 }) {
                return ready.remove(at: index)
            }
            if let index = (head..<pending.count).first(where: { index in
                guard let job = pending[index] else { return false }
                return !job.metadata || metadataRunning < 3
            }) {
                let job = pending[index]; pending[index] = nil
                while head < pending.count && pending[head] == nil { head += 1 }
                return job
            }
            return nil
        }
        enqueue(initial)
        while !ready.isEmpty || head < pending.count || running > 0 {
            if failure == nil { do { try checkWork() } catch { failure = error } }
            if failure != nil { pending.removeAll(); ready.removeAll(); head = 0 }
            while failure == nil && running < 4 {
                guard let job = take() else { break }
                running += 1
                if job.metadata { metadataRunning += 1 }
                discoveryQueue.async {
                    let value = Result { try self.checkWork(); return try job.operation() }
                    results.ready.lock()
                    results.values.append((job.metadata, value))
                    results.ready.signal()
                    results.ready.unlock()
                }
            }
            if head > 256 { pending.removeFirst(head); head = 0 }
            if running == 0 { break }
            results.ready.lock()
            while results.values.isEmpty { results.ready.wait() }
            let (metadata, result) = results.values.removeFirst()
            results.ready.unlock()
            running -= 1
            if metadata { metadataRunning -= 1 }
            if failure == nil {
                do {
                    try checkWork()
                    switch result {
                    case .success(let value): enqueue(try consume(value))
                    case .failure(let error): if operationFailure == nil { operationFailure = error }
                    }
                } catch { failure = error }
            }
        }
        if let error = failure ?? operationFailure { throw error }
    }
    private var pendingPicker: CAPPluginCall?
    private var pickingFolder = false
    private var replacingSource: String?
    // Access is balanced on disconnect/deinit, rather than before WebKit reads a URL.
    private var activeScopes: [String: URL] = [:]
    private struct LinkedItem: Codable {
        var id: String
        var name: String
        var path: String
        var mime: String
        var size: Int64
    }
    private struct Source: Codable {
        var id: String
        var name: String
        var kind: String
        var bookmark: Data
        var items: [LinkedItem]
        var excluded: [String]
    }
    deinit {
        removeStandbyObserver?()
        for url in activeScopes.values { url.stopAccessingSecurityScopedResource() }
    }
    private func sourceFile(_ id: String) throws -> URL {
        try directory().appendingPathComponent(id + ".source.json")
    }
    private func readMetadata(_ url: URL) throws -> Data? {
        try checkWork()
        let data = try? Data(contentsOf: url)
        // Keep the ticket through the synchronous read, then propagate
        // cancellation instead of treating it as a corrupt metadata file.
        try checkWork()
        return data
    }
    private func sources() throws -> [Source] {
        try checkWork()
        let root = try directory()
        let files = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
        try checkWork()
        var result: [Source] = []
        for url in files {
            try checkWork()
            guard url.lastPathComponent.hasSuffix(".source.json"), regularPrivateFile(url, in: root),
                  let data = try readMetadata(url), data.count < 8 * 1024 * 1024,
                  let source = try? JSONDecoder().decode(Source.self, from: data),
                  UUID(uuidString: source.id) != nil else { continue }
            result.append(source)
        }
        try checkWork()
        return result.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    private func save(_ source: Source) throws {
        let bytes = try JSONEncoder().encode(source)
        let file = try sourceFile(source.id)
        if let ticket = currentWork { try ticket.commit { try bytes.write(to: file, options: .atomic) } }
        else { try bytes.write(to: file, options: .atomic) }
    }
    private func release(_ id: String) {
        activeScopes.removeValue(forKey: id)?.stopAccessingSecurityScopedResource()
    }
    private func resolve(_ source: inout Source) throws -> URL {
        try checkWork()
        if let active = activeScopes[source.id] { return active }
        var stale = false
        let url = try URL(resolvingBookmarkData: source.bookmark, options: [.withoutUI],
                          relativeTo: nil, bookmarkDataIsStale: &stale)
        guard url.startAccessingSecurityScopedResource() else { throw CocoaError(.fileReadNoPermission) }
        activeScopes[source.id] = url
        if stale {
            do {
                source.bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
                try save(source)
            } catch { release(source.id); throw error }
        }
        return url
    }
    private func mediaInfo(_ url: URL) -> (String, Int64)? {
        guard let type = UTType(filenameExtension: url.pathExtension.lowercased()),
              type.conforms(to: .movie) || type.conforms(to: .audio),
              let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey]),
              values.isRegularFile == true, values.isSymbolicLink != true,
              let size = values.fileSize else { return nil }
        return (type.preferredMIMEType ?? "application/octet-stream", Int64(size))
    }
    private func child(_ path: String, root: URL) -> URL? {
        guard !path.hasPrefix("/"), !path.split(separator: "/").contains("..") else { return nil }
        let url = path.isEmpty ? root : root.appendingPathComponent(path)
        let base = root.resolvingSymlinksInPath().standardizedFileURL.path
        let resolved = url.resolvingSymlinksInPath().standardizedFileURL.path
        guard resolved == base || resolved.hasPrefix(base + "/") else { return nil }
        return url
    }
    private func linkedItemID(_ sourceID: String, path: String) -> String {
        // Source IDs cannot contain NUL; the separator keeps the scoped path
        // unambiguous. Stable IDs survive cancellation before the final save.
        var bytes = Array(SHA256.hash(data: Data((sourceID + "\0" + path).utf8)).prefix(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x80
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
            .uuidString.lowercased()
    }
    private final class DirectoryCursor {
        let iterator: FileManager.DirectoryEnumerator
        init(_ iterator: FileManager.DirectoryEnumerator) { self.iterator = iterator }
    }
    private enum DiscoveryResult {
        case directory(DirectoryCursor)
        case directoryFailed(Error)
        case entry(DirectoryCursor, URL?)
        case inspected(URL, String, Bool, (String, Int64)?)
    }
    private func refresh(_ source: inout Source, root: URL,
                         onItem: ((LinkedItem, URL) -> Void)? = nil,
                         onScan: (() -> Void)? = nil) throws {
        // Only the serial consumer touches this copy, the index or callbacks.
        // Workers never capture the caller's inout source/bookmark state.
        var updated = source
        defer { source = updated }
        var indices: [String: Int] = [:]
        for (index, item) in updated.items.enumerated() where indices[item.path] == nil { indices[item.path] = index }
        func append(_ path: String, _ url: URL, info: (String, Int64)) throws {
            try checkWork()
            guard !updated.excluded.contains(path) else { return }
            let (mime, size) = info
            let item: LinkedItem
            if let index = indices[path] {
                updated.items[index].name = String(url.lastPathComponent.prefix(256))
                updated.items[index].mime = mime
                updated.items[index].size = size
                item = updated.items[index]
            } else {
                item = LinkedItem(id: linkedItemID(updated.id, path: path), name: String(url.lastPathComponent.prefix(256)),
                                  path: path, mime: mime, size: size)
                indices[path] = updated.items.count
                updated.items.append(item)
            }
            onItem?(item, url)
        }
        if updated.kind == "folder" {
            let prefix = root.path.hasSuffix("/") ? root.path : root.path + "/"
            var scanned = 0
            var directories = 1
            var openDirectories = 1
            var pendingDirectories: [URL] = []
            var directoryFailure: Error?
            var seen = Set<String>([root.standardizedFileURL.path])
            typealias Job = LocalMediaDiscoveryJob<DiscoveryResult>
            func directory(_ url: URL) -> Job {
                return Job(metadata: true, ready: true) {
                    do {
                        try self.checkWork()
                        let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
                        guard values.isDirectory == true, values.isSymbolicLink != true else { throw CocoaError(.fileReadNoSuchFile) }
                        guard let iterator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: nil,
                            options: [.skipsSubdirectoryDescendants, .skipsHiddenFiles, .skipsPackageDescendants]) else { throw CocoaError(.fileReadNoPermission) }
                        return .directory(DirectoryCursor(iterator))
                    } catch { return .directoryFailed(error) }
                }
            }
            func next(_ cursor: DirectoryCursor, ready: Bool = false) -> Job {
                return Job(metadata: true, ready: ready) { .entry(cursor, cursor.iterator.nextObject() as? URL) }
            }
            func inspect(_ url: URL) -> Job {
                return Job(ready: true) {
                    try self.checkWork()
                    guard url.path.hasPrefix(prefix) else { return .inspected(url, "", false, nil) }
                    let relative = String(url.path.dropFirst(prefix.count))
                    let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey, .isPackageKey])
                    guard values.isSymbolicLink != true, self.child(relative, root: root) != nil else {
                        return .inspected(url, relative, false, nil)
                    }
                    if values.isDirectory == true {
                        return .inspected(url, relative, values.isPackage != true, nil)
                    }
                    return .inspected(url, relative, false, self.mediaInfo(url))
                }
            }
            func admitDirectories() -> [Job] {
                var jobs: [Job] = []
                while openDirectories < 64 && !pendingDirectories.isEmpty {
                    openDirectories += 1
                    jobs.append(directory(pendingDirectories.removeFirst()))
                }
                return jobs
            }
            try discover([directory(root)]) { result in
                switch result {
                case .directory(let cursor):
                    return [next(cursor, ready: true)]
                case .directoryFailed(let error):
                    openDirectories -= 1
                    if directoryFailure == nil { directoryFailure = error }
                    return admitDirectories()
                case .entry(let cursor, let url):
                    guard let url else { openDirectories -= 1; return admitDirectories() }
                    scanned += 1; onScan?()
                    guard scanned <= 20_000 else { throw CocoaError(.fileReadTooLarge) }
                    // Neither nextObject nor a sibling metadata read can hold
                    // the ready child's independent continuation.
                    return [inspect(url), next(cursor)]
                case .inspected(let url, let relative, let isDirectory, let info):
                    if isDirectory && seen.insert(url.standardizedFileURL.path).inserted {
                        directories += 1
                        guard directories <= 4_096 else { throw CocoaError(.fileReadTooLarge) }
                        pendingDirectories.append(url)
                        return admitDirectories()
                    }
                    if let info { try append(relative, url, info: info) }
                    return []
                }
            }
            if let directoryFailure { throw directoryFailure }
        } else {
            try discover([LocalMediaDiscoveryJob(ready: true) { self.mediaInfo(root) }]) { info in
                guard let info else { throw CocoaError(.fileReadNoSuchFile) }
                onScan?()
                try append("", root, info: info)
                return []
            }
        }
        // Keep absent records: the UI can explain a disconnected file instead of silently dropping it.
        try save(updated)
    }

    private struct Entry: Codable {
        let id: String
        let name: String
        let filename: String
        let mime: String
    }
    private func directory() throws -> URL {
        var directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                     appropriateFor: nil, create: true).appendingPathComponent("offline-media", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        // Video libraries can be large; they should not consume iCloud backups.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        return directory
    }
    private func regularPrivateFile(_ file: URL, in directory: URL) -> Bool {
        guard let values = try? file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey]),
              values.isRegularFile == true, values.isSymbolicLink != true else { return false }
        return file.resolvingSymlinksInPath().standardizedFileURL ==
            directory.resolvingSymlinksInPath().appendingPathComponent(file.lastPathComponent).standardizedFileURL
    }
    public override func load() {
        removeStandbyObserver = NativeWork.shared.onStandbyAsync { [weak self] done in
            guard let self else { done(); return }
            self.queue.async { [weak self] in
                defer { done() }
                guard let self else { return }
                for id in Array(self.activeScopes.keys) { self.release(id) }
            }
        }
        guard let ticket = NativeWork.shared.begin() else { return }
        queue.async {
            defer { ticket.finish() }
            guard (try? ticket.check()) != nil, let directory = try? self.directory(),
                  let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return }
            for file in files where file.pathExtension != "json" {
                guard (try? ticket.check()) != nil else { return }
                let id = file.deletingPathExtension().lastPathComponent
                if UUID(uuidString: id) != nil && !FileManager.default.fileExists(atPath: directory.appendingPathComponent(id + ".json").path) {
                    try? FileManager.default.removeItem(at: file)
                }
            }
        }
    }
    private func snapshot() throws -> [String: Any] {
        try checkWork()
        let directory = try directory()
        let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        try checkWork()
        var items: [[String: Any]] = []
        for metadata in files.filter({ $0.pathExtension == "json" }).sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            try checkWork()
            guard regularPrivateFile(metadata, in: directory),
                  let data = try readMetadata(metadata), let entry = try? JSONDecoder().decode(Entry.self, from: data),
                  UUID(uuidString: entry.id) != nil, !entry.filename.contains("/"),
                  entry.filename.hasPrefix(entry.id + ".") else { continue }
            let file = directory.appendingPathComponent(entry.filename)
            guard regularPrivateFile(file, in: directory),
                  let attributes = try? FileManager.default.attributesOfItem(atPath: file.path),
                  let size = attributes[.size] as? NSNumber,
                  let url = bridge?.portablePath(fromLocalURL: file) else { continue }
            items.append(["id": entry.id, "name": entry.name, "mime": entry.mime, "size": size.int64Value,
                          "relativePath": NSNull(),
                          "url": url.absoluteString, "source": "imported", "sourceId": "", "available": true, "access": "granted"])
        }
        var sourceRows: [[String: Any]] = []
        for var source in try sources() {
            try checkWork()
            var root: URL?
            var granted = false
            do {
                let resolved = try resolve(&source)
                try refresh(&source, root: resolved)
                root = resolved
                granted = true
            } catch { release(source.id) }
            sourceRows.append(["id": source.id, "name": source.name, "kind": source.kind,
                               "available": granted, "access": granted ? "granted" : "required"])
            for item in source.items where !source.excluded.contains(item.path) {
                try checkWork()
                let url = root.flatMap { child(item.path, root: $0) }
                let exists = url.flatMap { mediaInfo($0) } != nil
                let portable = exists ? url.flatMap { bridge?.portablePath(fromLocalURL: $0) } : nil
                items.append(["id": item.id, "name": item.name, "mime": item.mime, "size": item.size,
                              "relativePath": source.kind == "folder" ? item.path as Any : NSNull(),
                              "url": portable?.absoluteString ?? "", "source": "linked", "sourceId": source.id,
                              "directory": url?.deletingLastPathComponent().lastPathComponent ?? "",
                              "available": portable != nil, "access": granted ? "granted" : "required"])
            }
        }
        try checkWork()
        return ["available": true, "persistent": true, "storage": "device", "items": items, "sources": sourceRows,
                "directAccess": true, "folderAccess": true]
    }
    private func resolveSnapshot(_ call: CAPPluginCall) throws {
        let result = try snapshot()
        guard let ticket = currentWork else { throw URLError(.cancelled) }
        try ticket.commit { call.resolve(result) }
    }
    // Source selection reads only app-owned descriptors. A bookmark or saved
    // URI is not evidence that the original file is currently available.
    private func sourceDescriptors() throws -> [[String: Any]] {
        var rows: [[String: Any]] = try sources().map {
            ["id": $0.id, "name": $0.name, "kind": $0.kind, "access": "unknown"]
        }
        let directory = try directory()
        let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        for metadata in files where metadata.pathExtension == "json" && !metadata.lastPathComponent.hasSuffix(".source.json") {
            try checkWork()
            guard regularPrivateFile(metadata, in: directory), let data = try readMetadata(metadata),
                  let entry = try? JSONDecoder().decode(Entry.self, from: data), UUID(uuidString: entry.id) != nil else { continue }
            rows.append(["id": entry.id, "name": entry.name, "kind": "file", "access": "unknown"])
        }
        return rows
    }
    private func resolveRegistration(_ call: CAPPluginCall, ids: [String]) throws {
        let result: [String: Any] = ["available": true, "persistent": true, "storage": "device",
            "directAccess": true, "folderAccess": true, "sourceIds": ids,
            "items": [], "scanning": true]
        guard let ticket = currentWork else { throw URLError(.cancelled) }
        try ticket.commit { call.resolve(result) }
    }
    @objc func sources(_ call: CAPPluginCall) {
        tracked(call) {
            do {
                let result: [String: Any] = ["available": true, "persistent": true, "storage": "device",
                    "sources": try self.sourceDescriptors()]
                guard let ticket = self.currentWork else { throw URLError(.cancelled) }
                try ticket.commit { call.resolve(result) }
            } catch { call.reject("Local media sources unavailable") }
        }
    }
    private func progressSnapshot(_ call: CAPPluginCall, requestId: String) throws {
        guard let ticket = currentWork else { throw URLError(.cancelled) }
        let directory = try directory()
        let selectedIds = Set(call.getArray("sourceIds", String.self) ?? [])
        let stored = try sources()
        var saved = stored.filter { selectedIds.contains($0.id) } + stored.filter { !selectedIds.contains($0.id) }
        var items: [String: [String: Any]] = [:]
        var order: [String] = []
        var sourceRows: [[String: Any]] = saved.map { ["id": $0.id, "name": $0.name, "kind": $0.kind,
            "available": false, "access": "required"] }
        var scanned = 0
        let preferredId = call.getString("preferredId") ?? ""
        var preferredState = "pending"
        var lastPublish = Date.distantPast
        func catalog(_ scanning: Bool) -> [String: Any] {
            var result: [String: Any] = ["available": true, "persistent": true, "storage": "device",
                "directAccess": true, "folderAccess": true, "items": order.compactMap { items[$0] },
                "sources": sourceRows, "scanning": scanning, "scanned": scanned]
            if !scanning { result["total"] = scanned }
            if !preferredId.isEmpty { result["preferred"] = ["id": preferredId, "state": preferredState] }
            return result
        }
        func publish(_ force: Bool = false) throws {
            try checkWork()
            guard force || Date().timeIntervalSince(lastPublish) >= 0.25 else { return }
            lastPublish = Date()
            let value = catalog(true)
            try ticket.commit { self.notifyListeners("localMediaProgress", data: ["requestId": requestId, "catalog": value]) }
        }
        func append(_ row: [String: Any]) throws {
            guard let id = row["id"] as? String else { return }
            let first = !items.values.contains { $0["available"] as? Bool == true }
            if items[id] == nil { order.append(id) }
            items[id] = row
            if id == preferredId && row["available"] as? Bool == true { preferredState = "found" }
            try publish(first && row["available"] as? Bool == true)
        }
        func linked(_ item: LinkedItem, _ source: Source, _ url: URL?, validated: Bool = false) -> [String: Any] {
            // refresh validated this exact URL immediately before its callback.
            // Saved records and preferred-item lookups still validate live access.
            let portable = url.flatMap { validated || mediaInfo($0) != nil ? bridge?.portablePath(fromLocalURL: $0) : nil }
            return ["id": item.id, "name": item.name, "mime": item.mime, "size": item.size,
                "relativePath": source.kind == "folder" ? item.path as Any : NSNull(),
                "url": portable?.absoluteString ?? "", "source": "linked", "sourceId": source.id,
                "directory": url?.deletingLastPathComponent().lastPathComponent ?? "", "available": portable != nil]
        }
        // Resolve only the saved item first. The rest of the directory is not
        // traversed until this result (including definitive absence) is published.
        if UUID(uuidString: preferredId) != nil {
            if let index = saved.firstIndex(where: { $0.items.contains { $0.id == preferredId } }),
               let item = saved[index].items.first(where: { $0.id == preferredId }) {
                do {
                    let root = try resolve(&saved[index])
                    sourceRows[index]["available"] = true; sourceRows[index]["access"] = "granted"
                    if let url = child(item.path, root: root) {
                        _ = try url.resourceValues(forKeys: [.isRegularFileKey])
                        try append(linked(item, saved[index], url))
                    }
                } catch {
                    let error = error as NSError
                    if error.domain == NSCocoaErrorDomain && [NSFileReadNoSuchFileError, NSFileNoSuchFileError].contains(error.code) {
                        preferredState = "missing"
                    }
                    try checkWork()
                }
            } else {
                let metadata = directory.appendingPathComponent(preferredId + ".json")
                if !FileManager.default.fileExists(atPath: metadata.path) { preferredState = "missing" }
                else if let data = try readMetadata(metadata), let entry = try? JSONDecoder().decode(Entry.self, from: data),
                        entry.id == preferredId, !entry.filename.contains("/"), entry.filename.hasPrefix(entry.id + ".") {
                    let file = directory.appendingPathComponent(entry.filename)
                    if !FileManager.default.fileExists(atPath: file.path) { preferredState = "missing" }
                    else if regularPrivateFile(file, in: directory), let info = mediaInfo(file), let url = bridge?.portablePath(fromLocalURL: file) {
                        try append(["id": entry.id, "name": entry.name, "mime": entry.mime, "size": info.1,
                            "relativePath": NSNull(),
                            "url": url.absoluteString, "source": "imported", "sourceId": entry.id, "available": true])
                    }
                }
            }
        }
        func scan(_ index: Int) throws {
            try checkWork()
            var source = saved[index]
            do {
                let root = try resolve(&source)
                sourceRows[index] = ["id": source.id, "name": source.name, "kind": source.kind, "available": true, "access": "granted"]
                let identity = source
                try refresh(&source, root: root, onItem: { item, url in
                    // The work ticket also owns progress delivery. A cancelled
                    // source never publishes a late snapshot into the new list.
                    try? append(linked(item, identity, url, validated: true))
                }, onScan: { scanned += 1; try? publish() })
                let remaining = source.items.filter { items[$0.id] == nil && !source.excluded.contains($0.path) }
                let stableSource = source
                try discover(remaining.map { item in
                    return LocalMediaDiscoveryJob(ready: true) { linked(item, stableSource, self.child(item.path, root: root)) }
                }) { row in
                    try append(row)
                    return []
                }
            } catch {
                try checkWork()
                sourceRows[index] = ["id": source.id, "name": source.name, "kind": source.kind, "available": false, "access": "required"]
            }
        }
        try publish(true)
        for index in saved.indices where selectedIds.contains(saved[index].id) { try scan(index) }
        let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        for metadata in files where metadata.pathExtension == "json" && !metadata.lastPathComponent.hasSuffix(".source.json") {
            try checkWork()
            scanned += 1
            guard regularPrivateFile(metadata, in: directory), let data = try readMetadata(metadata),
                  let entry = try? JSONDecoder().decode(Entry.self, from: data), UUID(uuidString: entry.id) != nil,
                  !entry.filename.contains("/"), entry.filename.hasPrefix(entry.id + ".") else { continue }
            let file = directory.appendingPathComponent(entry.filename)
            if regularPrivateFile(file, in: directory), let info = mediaInfo(file), let url = bridge?.portablePath(fromLocalURL: file) {
                try append(["id": entry.id, "name": entry.name, "mime": entry.mime, "size": info.1,
                    "relativePath": NSNull(),
                    "url": url.absoluteString, "source": "imported", "sourceId": entry.id, "available": true])
            }
            try publish()
        }
        for index in saved.indices where !selectedIds.contains(saved[index].id) { try scan(index) }
        try ticket.commit { call.resolve(catalog(false)) }
    }
    @objc func cancelList(_ call: CAPPluginCall) {
        listLock.lock(); let ticket = listWork[call.getString("requestId") ?? ""]; listLock.unlock()
        ticket?.cancelWork()
        call.resolve()
    }
    @objc func list(_ call: CAPPluginCall) {
        tracked(call, requestId: call.getString("requestId")) { [weak self] in
            guard let self else { call.reject("Local media unavailable"); return }
            do {
                if let requestId = call.getString("requestId"), !requestId.isEmpty { try self.progressSnapshot(call, requestId: requestId) }
                else { try self.resolveSnapshot(call) }
            } catch { call.reject("Local media unavailable") }
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), UUID(uuidString: id) != nil else { call.reject("Invalid local media ID"); return }
        tracked(call) { [weak self] in
            guard let self else { call.reject("Local media unavailable"); return }
            do {
                for var source in try self.sources() {
                    if let item = source.items.first(where: { $0.id == id }) {
                        source.excluded.append(item.path)
                        source.items.removeAll { $0.id == id }
                        try self.save(source)
                        try self.resolveSnapshot(call)
                        return
                    }
                }
                let directory = try self.directory()
                let metadata = directory.appendingPathComponent(id + ".json")
                if FileManager.default.fileExists(atPath: metadata.path) {
                    let entry = try JSONDecoder().decode(Entry.self, from: Data(contentsOf: metadata))
                    guard entry.filename.hasPrefix(id + "."), !entry.filename.contains("/") else {
                        call.reject("Invalid local media record"); return
                    }
                    try FileManager.default.removeItem(at: directory.appendingPathComponent(entry.filename))
                    try FileManager.default.removeItem(at: metadata)
                }
                try self.resolveSnapshot(call)
            } catch { call.reject("Unable to delete local media") }
        }
    }
    @objc func importFiles(_ call: CAPPluginCall) { presentPicker(call, folder: false) }
    @objc func importFolder(_ call: CAPPluginCall) { presentPicker(call, folder: true) }
    @objc func requestAccess(_ call: CAPPluginCall) {
        let id = call.getString("id")
        if let id, UUID(uuidString: id) == nil { call.reject("Unknown local media source"); return }
        tracked(call) {
            do {
                let saved = try self.sources()
                var target = id.flatMap { requested in saved.first { $0.id == requested } }
                if id == nil {
                    target = saved.first { savedSource in
                        var source = savedSource
                        do {
                            let root = try self.resolve(&source)
                            try self.refresh(&source, root: root)
                            return false
                        } catch { self.release(source.id); return true }
                    }
                }
                guard let source = target else {
                    if id != nil { call.reject("Unknown local media source") }
                    else { try self.resolveSnapshot(call) }
                    return
                }
                self.presentPicker(call, folder: source.kind == "folder", replacing: source.id)
            } catch { call.reject("Local media sources unavailable") }
        }
    }
    @objc func removeSource(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), UUID(uuidString: id) != nil else { call.reject("Invalid source ID"); return }
        tracked(call) {
            do {
                self.release(id)
                let file = try self.sourceFile(id)
                if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
                try self.resolveSnapshot(call)
            } catch { call.reject("Unable to disconnect local media source") }
        }
    }
    private func presentPicker(_ call: CAPPluginCall, folder: Bool, replacing: String? = nil) {
        DispatchQueue.main.async {
            guard !NativeWork.shared.isStandby else { call.reject("Player is in standby", "standby"); return }
            guard self.pendingPicker == nil else { call.reject("A media picker is already open"); return }
            guard let presenter = self.bridge?.viewController else { call.reject("Media picker unavailable"); return }
            self.pendingPicker = call
            self.pickingFolder = folder
            self.replacingSource = replacing
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: folder ? [.folder] : [.movie, .audio], asCopy: false)
            picker.allowsMultipleSelection = !folder && replacing == nil
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard let call = pendingPicker else { return }
        pendingPicker = nil
        replacingSource = nil
        if call.getBool("progressive") == true { call.resolve(["pickerCancelled": true]); return }
        list(call)
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pendingPicker else { return }
        pendingPicker = nil
        let folder = pickingFolder
        let replacing = replacingSource
        replacingSource = nil
        guard urls.count <= 128 else { call.reject("Select at most 128 files at once"); return }
        tracked(call) {
            var created: [String] = []
            var selected: [String] = []
            let progressive = call.getBool("progressive") == true
            do {
                for url in urls {
                    try self.checkWork()
                    guard url.startAccessingSecurityScopedResource() else { throw CocoaError(.fileReadNoPermission) }
                    defer { url.stopAccessingSecurityScopedResource() }
                    if !progressive {
                        let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
                        guard values.isSymbolicLink != true,
                              folder ? values.isDirectory == true : self.mediaInfo(url) != nil else {
                            throw CocoaError(.fileReadUnsupportedScheme)
                        }
                    }
                    var source = Source(id: replacing ?? UUID().uuidString.lowercased(), name: String(url.lastPathComponent.prefix(256)),
                                        kind: folder ? "folder" : "file",
                                        bookmark: try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil),
                                        items: [], excluded: [])
                    if let replacing, let old = try self.sources().first(where: { $0.id == replacing }) {
                        source.items = old.items
                        source.excluded = old.excluded
                    }
                    if progressive { try self.save(source) }
                    else { try self.refresh(&source, root: url) }
                    self.release(source.id)
                    selected.append(source.id)
                    if replacing == nil { created.append(source.id) }
                }
                if progressive { try self.resolveRegistration(call, ids: selected) }
                else { try self.resolveSnapshot(call) }
            } catch {
                for id in created {
                    self.release(id)
                    if let file = try? self.sourceFile(id) { try? FileManager.default.removeItem(at: file) }
                }
                call.reject("Unable to link media; select accessible local files or a folder")
            }
        }
    }
}
