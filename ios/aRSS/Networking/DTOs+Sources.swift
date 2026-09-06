// Mirrors packages/shared/src/sources.ts — keep field names and optionality identical.
import Foundation

nonisolated enum BypassStrategy: String, TolerantEnum {
    case `default`, ladder, googlebot, wayback, archive_ph, none, unknown
    init(from decoder: any Decoder) throws { self = try Self.decodeTolerant(from: decoder) }

    /// The web's `<select>` labels (apps/web/src/pages/Sources.tsx).
    var label: String {
        switch self {
        case .default: "Bypass · default chain"
        case .ladder: "Bypass · Ladder (self-hosted)"
        case .googlebot: "Bypass · Googlebot only"
        case .wayback: "Bypass · web.archive.org"
        case .archive_ph: "Bypass · archive.ph"
        case .none: "Bypass off (plain)"
        case .unknown: "Bypass · unknown"
        }
    }
}

nonisolated struct Category: Codable, Sendable, Hashable, Identifiable {
    var id: String
    var name: String
    /// `#RRGGBB`. The key is omitted entirely when unset (never `null`).
    var color: String?
}

nonisolated struct Source: Codable, Sendable, Hashable, Identifiable {
    var id: String
    var feedUrl: String
    var siteUrl: String?
    var title: String
    var categoryId: String?
    var pollIntervalMs: Int
    var bypassStrategy: BypassStrategy
    var lastPolledAt: Date?
}

nonisolated struct CreateSourceRequest: Encodable, Sendable {
    var feedUrl: String
    var categoryId: String?
    var bypassStrategy: BypassStrategy?
}

/// A tri-state patch value: absent (leave alone), `.clear` (send `null`), or `.set`.
nonisolated enum Patch<Value: Encodable & Sendable & Hashable>: Sendable, Hashable {
    case set(Value)
    case clear
}

nonisolated struct UpdateSourceRequest: Encodable, Sendable {
    var feedUrl: String?
    /// `.clear` sends `"categoryId": null`, which un-assigns the category (the API accepts
    /// null here; the web's Uncategorized option never actually cleared it).
    var categoryId: Patch<String>?
    var bypassStrategy: BypassStrategy?
    /// Setting a title flips `titleOverridden` server-side so polls stop overwriting it.
    var title: String?

    private enum CodingKeys: String, CodingKey { case feedUrl, categoryId, bypassStrategy, title }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(feedUrl, forKey: .feedUrl)
        try container.encodeIfPresent(bypassStrategy, forKey: .bypassStrategy)
        try container.encodeIfPresent(title, forKey: .title)
        switch categoryId {
        case .set(let id): try container.encode(id, forKey: .categoryId)
        case .clear: try container.encodeNil(forKey: .categoryId)
        case nil: break
        }
    }
}

nonisolated struct CreateCategoryRequest: Encodable, Sendable {
    var name: String
    var color: String?
}

nonisolated struct UpdateCategoryRequest: Encodable, Sendable {
    var name: String?
    var color: String?
}
