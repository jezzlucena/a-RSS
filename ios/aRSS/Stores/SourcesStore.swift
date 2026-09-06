import Foundation

/// Mirrors apps/web/src/stores/sources.ts: categories, sources and the advisory unread counts.
/// Lists are re-sorted client-side after every mutation (name / title), matching the server order.
@Observable
final class SourcesStore {
    private(set) var categories: [Category] = []
    private(set) var sources: [Source] = []
    private(set) var unreadCounts: UnreadCounts = .empty
    private(set) var loading = false
    private(set) var error: String?
    private(set) var hasLoaded = false

    private let api: any ARSSAPI
    private let auth: AuthStore

    init(api: any ARSSAPI, auth: AuthStore) {
        self.api = api
        self.auth = auth
    }

    // MARK: Loading

    /// Categories and sources are required; a failing counts call is tolerated (web `.catch`).
    func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            async let categoriesTask = api.categories()
            async let sourcesTask = api.sources()
            async let countsTask: UnreadCounts? = try? api.unreadCounts()
            let (fetchedCategories, fetchedSources, counts) = try await (categoriesTask, sourcesTask, countsTask)
            categories = Self.sortCategories(fetchedCategories)
            sources = Self.sortSources(fetchedSources)
            unreadCounts = counts ?? .empty
            hasLoaded = true
        } catch {
            auth.noteError(error)
            self.error = error.userMessage(fallback: "Could not load sources")
        }
    }

    /// Fire-and-forget from the feed after read-state changes; failures are swallowed.
    func refreshUnreadCounts() async {
        if let counts = try? await api.unreadCounts() {
            unreadCounts = counts
        }
    }

    // MARK: Lookups

    func category(id: String?) -> Category? {
        guard let id else { return nil }
        return categories.first { $0.id == id }
    }

    func source(id: String) -> Source? {
        sources.first { $0.id == id }
    }

    /// The feed masthead kicker: "All Sources", the category name, or the source title, with
    /// the web's literal fallbacks when the id isn't (yet) known.
    func title(for scope: FeedScope) -> String {
        switch scope {
        case .all: "All Sources"
        case .category(let id): category(id: id)?.name ?? "Category"
        case .source(let id): source(id: id)?.title ?? "Source"
        }
    }

    func unreadCount(for scope: FeedScope) -> Int {
        switch scope {
        case .all: unreadCounts.all
        case .category(let id): unreadCounts.categories[id] ?? 0
        case .source(let id): unreadCounts.sources[id] ?? 0
        }
    }

    func sourceCount(categoryId: String) -> Int {
        sources.filter { $0.categoryId == categoryId }.count
    }

    // MARK: Categories

    func createCategory(name: String, color: String?) async throws -> Category {
        let created = try await run { try await api.createCategory(CreateCategoryRequest(name: name, color: color)) }
        categories = Self.sortCategories(categories + [created])
        return created
    }

    func updateCategory(id: String, _ patch: UpdateCategoryRequest) async throws {
        let updated = try await run { try await api.updateCategory(id: id, patch) }
        categories = Self.sortCategories(categories.map { $0.id == id ? updated : $0 })
    }

    /// The server detaches the category's sources rather than deleting them; mirror locally.
    func deleteCategory(id: String) async throws {
        try await run { try await api.deleteCategory(id: id) }
        categories.removeAll { $0.id == id }
        sources = sources.map { source in
            var source = source
            if source.categoryId == id { source.categoryId = nil }
            return source
        }
    }

    // MARK: Sources

    func createSource(feedUrl: String, categoryId: String?) async throws -> Source {
        let created = try await run { try await api.createSource(CreateSourceRequest(feedUrl: feedUrl, categoryId: categoryId, bypassStrategy: nil)) }
        sources = Self.sortSources(sources + [created])
        return created
    }

    func updateSource(id: String, _ patch: UpdateSourceRequest) async throws {
        let updated = try await run { try await api.updateSource(id: id, patch) }
        sources = Self.sortSources(sources.map { $0.id == id ? updated : $0 })
    }

    func deleteSource(id: String) async throws {
        try await run { try await api.deleteSource(id: id) }
        sources.removeAll { $0.id == id }
    }

    /// Synchronous server-side poll; replaces the source in place without re-sorting (web).
    func refreshSource(id: String) async throws {
        let refreshed = try await run { try await api.refreshSource(id: id) }
        sources = sources.map { $0.id == id ? refreshed : $0 }
    }

    // MARK: OPML

    func importOPML(xml: String) async throws -> OPMLImportResult {
        let result = try await run { try await api.importOPML(xml: xml) }
        await load()
        return result
    }

    func exportOPML() async throws -> Data {
        try await run { try await api.exportOPML() }
    }

    // MARK: Helpers

    private func run<T>(_ operation: () async throws -> T) async throws -> T {
        do {
            return try await operation()
        } catch {
            auth.noteError(error)
            throw error
        }
    }

    private static func sortCategories(_ list: [Category]) -> [Category] {
        list.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private static func sortSources(_ list: [Source]) -> [Source] {
        list.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }
}
