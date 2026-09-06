// Mirrors packages/shared/src/entries.ts — keep field names and optionality identical.
import Foundation

nonisolated enum ProcessingState: String, TolerantEnum {
    case pending, fetched, summarized, failed, unknown
    init(from decoder: any Decoder) throws { self = try Self.decodeTolerant(from: decoder) }
}

nonisolated enum ImageSource: String, TolerantEnum {
    case og, inline, placeholder, unknown
    init(from decoder: any Decoder) throws { self = try Self.decodeTolerant(from: decoder) }
}

nonisolated struct EntrySummary: Codable, Sendable, Hashable {
    var intro: String?
    /// Always exactly three on the wire (a Zod tuple); kept as an array for safety.
    var bullets: [String]
    var model: String
    var generatedAt: Date
}

nonisolated struct EntryImage: Codable, Sendable, Hashable {
    var url: String
    var source: ImageSource
}

nonisolated struct Entry: Codable, Sendable, Hashable, Identifiable {
    var id: String
    var sourceId: String
    var sourceTitle: String
    var categoryId: String?
    var url: String
    var title: String
    var publishedAt: Date
    /// Never rendered by the web client either; kept for wire parity.
    var description: String?
    var summary: EntrySummary?
    var image: EntryImage?
    var processingState: ProcessingState
    var isRead: Bool
    var error: String?

    var canExpand: Bool { processingState != .failed }
}

nonisolated struct EntryDetail: Codable, Sendable, Hashable, Identifiable {
    var id: String
    var sourceId: String
    var sourceTitle: String
    var categoryId: String?
    var url: String
    var title: String
    var publishedAt: Date
    var description: String?
    var summary: EntrySummary?
    var image: EntryImage?
    var processingState: ProcessingState
    var isRead: Bool
    var error: String?
    /// Extracted on every request from stored HTML; nil when nothing could be extracted.
    var articleText: String?
    var byline: String?

    /// The list-shaped projection, for syncing read/summary state back into the feed.
    var entry: Entry {
        Entry(
            id: id, sourceId: sourceId, sourceTitle: sourceTitle, categoryId: categoryId, url: url,
            title: title, publishedAt: publishedAt, description: description, summary: summary,
            image: image, processingState: processingState, isRead: isRead, error: error
        )
    }
}
