import Foundation
import Observation

@Observable
@MainActor
final class FeedStore {
    var view: FeedView = .all
    var order: FeedOrder = .desc
    var entries: [Entry] = []
    var cursor: String?
    var unreadCount: Int = 0
    var loading = false
    var lastError: String?

    private let api: APIClient = .shared
    private let pageLimit = 30

    func setViewAndOrder(_ view: FeedView, _ order: FeedOrder) {
        guard view != self.view || order != self.order else { return }
        self.view = view
        self.order = order
        self.entries = []
        self.cursor = nil
        self.unreadCount = 0
        self.lastError = nil
    }

    func loadInitial() async {
        loading = true
        lastError = nil
        entries = []
        cursor = nil
        defer { loading = false }
        do {
            let page = try await fetchPage(cursor: nil)
            entries = page.entries
            cursor = page.nextCursor
            unreadCount = page.unreadCount
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadMore() async {
        guard let c = cursor, !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let page = try await fetchPage(cursor: c)
            entries.append(contentsOf: page.entries)
            cursor = page.nextCursor
            unreadCount = page.unreadCount
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func fetchPage(cursor: String?) async throws -> FeedResponse {
        var components = URLComponents()
        components.queryItems = [
            URLQueryItem(name: "view", value: view.apiValue),
            URLQueryItem(name: "order", value: order.rawValue),
            URLQueryItem(name: "limit", value: String(pageLimit))
        ]
        if let cursor { components.queryItems?.append(URLQueryItem(name: "cursor", value: cursor)) }
        let path = "/feeds?" + (components.percentEncodedQuery ?? "")
        return try await api.get(path)
    }

    @discardableResult
    func toggleRead(_ entry: Entry) async -> Bool {
        let next = !entry.isRead
        // Optimistic local update
        entries = entries.map { $0.id == entry.id ? entry.with(isRead: next) : $0 }
        unreadCount = max(0, unreadCount + (next ? -1 : 1))
        do {
            let _: SetEntryReadResponse = try await api.post(
                "/entries/\(entry.id)/read",
                body: SetEntryReadRequest(read: next)
            )
            return next
        } catch {
            // Revert
            entries = entries.map { $0.id == entry.id ? entry.with(isRead: !next) : $0 }
            unreadCount = max(0, unreadCount + (next ? 1 : -1))
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return entry.isRead
        }
    }

    @discardableResult
    func markBulkRead(scope: BulkMarkReadScope) async -> Int {
        do {
            let response: BulkMarkReadResponse = try await api.post(
                "/feeds/mark-read",
                body: BulkMarkReadRequest(view: view.apiValue, scope: scope)
            )
            applyOptimistic(scope: scope)
            unreadCount = max(0, unreadCount - response.marked)
            return response.marked
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return 0
        }
    }

    private func applyOptimistic(scope: BulkMarkReadScope) {
        let cutoff: Date
        switch scope {
        case .all: cutoff = .distantFuture
        case .olderThan1d: cutoff = Date().addingTimeInterval(-86_400)
        case .olderThan7d: cutoff = Date().addingTimeInterval(-7 * 86_400)
        }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let altFormatter = ISO8601DateFormatter()
        entries = entries.map { entry in
            let parsed = formatter.date(from: entry.publishedAt) ?? altFormatter.date(from: entry.publishedAt)
            guard let parsed, parsed <= cutoff else { return entry }
            return Entry(
                id: entry.id,
                sourceId: entry.sourceId,
                sourceTitle: entry.sourceTitle,
                categoryId: entry.categoryId,
                url: entry.url,
                title: entry.title,
                publishedAt: entry.publishedAt,
                description: entry.description,
                summary: entry.summary,
                image: entry.image,
                processingState: entry.processingState,
                isRead: true
            )
        }
    }
}
