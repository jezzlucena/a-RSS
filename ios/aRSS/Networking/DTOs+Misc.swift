// Mirrors packages/shared/src/errors.ts, the OPML schemas in sources.ts, and the
// `/entries/failures` shape from apps/api/src/controllers/entries.ts.
import Foundation

/// The standard error envelope. `message` is absent on `validation_error`; `retryable` is
/// always present in practice but decoded leniently.
nonisolated struct APIErrorBody: Decodable, Sendable {
    var error: String
    var message: String?
    var retryable: Bool?
}

nonisolated struct OPMLImportRequest: Encodable, Sendable {
    var xml: String
}

nonisolated struct OPMLImportResult: Decodable, Sendable, Hashable {
    var importedCategories: Int
    var importedSources: Int
    var skippedSources: Int
}

nonisolated struct FailedEntry: Decodable, Sendable, Hashable, Identifiable {
    var id: String
    var sourceId: String
    var sourceTitle: String
    var url: String
    var title: String
    var publishedAt: Date
    var updatedAt: Date
    var error: String?
}

nonisolated struct FailuresResponse: Decodable, Sendable {
    var items: [FailedEntry]
}
