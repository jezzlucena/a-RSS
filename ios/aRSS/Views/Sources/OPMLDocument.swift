import SwiftUI
import UniformTypeIdentifiers

/// Wraps the OPML export bytes for `.fileExporter` (the web triggers a browser download of
/// `a-rss-subscriptions.opml`).
nonisolated struct OPMLDocument: FileDocument, Sendable {
    static let opmlType = UTType(filenameExtension: "opml") ?? .xml
    static var readableContentTypes: [UTType] { [opmlType, .xml] }
    static var writableContentTypes: [UTType] { [opmlType, .xml] }

    var data: Data

    init(data: Data) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
