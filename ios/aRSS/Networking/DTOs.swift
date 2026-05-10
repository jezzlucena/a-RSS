import Foundation

// Mirrors packages/shared. Hand-rolled to avoid a code-gen dep at this stage.

enum AuthMethod: String, Codable {
    case password
    case magic
    case google
}

struct MeResponse: Codable, Equatable {
    let id: String
    let email: String
    let displayName: String?
    let authMethods: [AuthMethod]
}

struct AuthTokensResponse: Codable {
    let accessToken: String
    let expiresIn: Int
}

struct SignupRequest: Codable {
    let email: String
    let password: String
    let displayName: String?
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct MagicRequest: Codable {
    let email: String
}

struct MagicConsumeRequest: Codable {
    let token: String
}

enum BypassStrategy: String, Codable, CaseIterable {
    case `default`
    case ladder
    case googlebot
    case wayback
    case archive_ph
    case none
}

struct Category: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let color: String?
}

struct Source: Codable, Identifiable, Equatable {
    let id: String
    let feedUrl: String
    let siteUrl: String?
    let title: String
    let categoryId: String?
    let pollIntervalMs: Int
    let bypassStrategy: BypassStrategy
    let lastPolledAt: String?
}

enum ProcessingState: String, Codable {
    case pending
    case fetched
    case summarized
    case failed
}

struct EntrySummary: Codable, Equatable {
    let intro: String?
    let bullets: [String]
    let model: String
    let generatedAt: String
}

enum ImageSource: String, Codable {
    case og
    case inline
    case placeholder
}

struct EntryImage: Codable, Equatable {
    let url: String
    let source: ImageSource
}

struct Entry: Codable, Identifiable, Equatable {
    let id: String
    let sourceId: String
    let sourceTitle: String
    let categoryId: String?
    let url: String
    let title: String
    let publishedAt: String
    let description: String?
    let summary: EntrySummary?
    let image: EntryImage?
    let processingState: ProcessingState
    let isRead: Bool

    func with(isRead: Bool) -> Entry {
        Entry(
            id: id,
            sourceId: sourceId,
            sourceTitle: sourceTitle,
            categoryId: categoryId,
            url: url,
            title: title,
            publishedAt: publishedAt,
            description: description,
            summary: summary,
            image: image,
            processingState: processingState,
            isRead: isRead
        )
    }
}

enum FeedView: Hashable {
    case all
    case category(String)
    case source(String)

    var apiValue: String {
        switch self {
        case .all: return "all"
        case .category(let id): return "category:\(id)"
        case .source(let id): return "source:\(id)"
        }
    }
}

enum FeedOrder: String, Codable {
    case asc
    case desc
}

struct FeedResponse: Codable {
    let entries: [Entry]
    let nextCursor: String?
    let unreadCount: Int
}

enum BulkMarkReadScope: String, Codable {
    case all
    case olderThan1d
    case olderThan7d
}

struct BulkMarkReadRequest: Codable {
    let view: String
    let scope: BulkMarkReadScope
}

struct BulkMarkReadResponse: Codable {
    let marked: Int
}

struct EntryDetail: Codable, Equatable {
    let id: String
    let sourceId: String
    let sourceTitle: String
    let categoryId: String?
    let url: String
    let title: String
    let publishedAt: String
    let description: String?
    let summary: EntrySummary?
    let image: EntryImage?
    let processingState: ProcessingState
    let isRead: Bool
    let articleText: String?
    let byline: String?
}

struct FailedEntrySummary: Codable, Identifiable, Equatable {
    let id: String
    let sourceId: String
    let sourceTitle: String
    let url: String
    let title: String
    let publishedAt: String
    let updatedAt: String
    let error: String?
}

struct FailuresResponse: Codable {
    let items: [FailedEntrySummary]
}

struct SetEntryReadRequest: Codable {
    let read: Bool
}

struct SetEntryReadResponse: Codable {
    let isRead: Bool
}

/// Wrapper used as a typed navigation destination so we can push an entry detail screen.
struct EntryRoute: Hashable {
    let id: String
}
