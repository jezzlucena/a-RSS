// Mirrors packages/shared/src/feeds.ts (plus the unread-counts shape from
// apps/api/src/controllers/feeds.ts) — keep field names and optionality identical.
import Foundation

nonisolated enum FeedOrder: String, Codable, Sendable, CaseIterable {
    case asc, desc
}

nonisolated struct FeedResponse: Decodable, Sendable {
    var entries: [Entry]
    var nextCursor: String?
    /// Unread total for the whole view, independent of pagination and of the unread filter.
    var unreadCount: Int
}

/// `GET /feeds/unread-counts`. Zero counts are omitted from the maps — treat a missing key as 0.
nonisolated struct UnreadCounts: Decodable, Sendable, Hashable {
    var all: Int
    var categories: [String: Int]
    var sources: [String: Int]

    static let empty = UnreadCounts(all: 0, categories: [:], sources: [:])

    init(all: Int, categories: [String: Int], sources: [String: Int]) {
        self.all = all
        self.categories = categories
        self.sources = sources
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        all = try container.decodeIfPresent(Int.self, forKey: .all) ?? 0
        categories = try container.decodeIfPresent([String: Int].self, forKey: .categories) ?? [:]
        sources = try container.decodeIfPresent([String: Int].self, forKey: .sources) ?? [:]
    }

    private enum CodingKeys: String, CodingKey { case all, categories, sources }
}

nonisolated enum BulkMarkReadScope: String, Codable, Sendable, CaseIterable {
    case all, olderThan1d, olderThan7d
}

nonisolated struct BulkMarkReadRequest: Encodable, Sendable {
    var view: String
    var scope: BulkMarkReadScope
}

nonisolated struct BulkMarkReadResponse: Decodable, Sendable {
    var marked: Int
}

nonisolated struct SetEntryReadRequest: Encodable, Sendable {
    var read: Bool
}

nonisolated struct SetEntryReadResponse: Decodable, Sendable {
    var isRead: Bool
}

nonisolated struct SummarizeResponse: Decodable, Sendable {
    var summary: EntrySummary
    var processingState: ProcessingState
}

/// A summary produced on this device (Apple Foundation Models), stored via PUT /entries/:id/summary.
nonisolated struct ClientSummaryRequest: Encodable, Sendable, Hashable {
    var intro: String?
    var bullets: [String]
    var model: String
}

nonisolated struct RefreshSourcesRequest: Encodable, Sendable {
    var view: String
}
