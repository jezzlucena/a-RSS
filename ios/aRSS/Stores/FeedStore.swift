import Foundation

/// Mirrors apps/web/src/stores/feed.ts rule for rule, plus the card-expansion state the web
/// keeps in `Feed.tsx` (lifted here so cards, keyboard shortcuts and navigation share it).
@Observable
final class FeedStore {
    enum Filter: String, CaseIterable, Identifiable {
        case all, unread
        var id: String { rawValue }
        var label: String { rawValue.capitalized }
    }

    struct SummaryFailure: Equatable {
        let message: String
        let retryable: Bool
        /// The API's machine code (e.g. `llm_not_configured`), when the failure came from it.
        let code: String?
    }

    struct ScrollRequest: Equatable {
        enum Target: Equatable { case top, entry(String) }
        let target: Target
        let token = UUID()
    }

    static let pageLimit = Endpoints.pageLimit

    private(set) var scope: FeedScope = .all
    private(set) var order: FeedOrder = .desc
    private(set) var filter: Filter = .unread
    private(set) var entries: [Entry] = []
    /// New entries found by a passive refresh, held back until the user taps the "N new" pill.
    private(set) var pendingEntries: [Entry] = []
    private(set) var cursor: String?
    private(set) var unreadCount = 0
    private(set) var loading = false
    private(set) var polling = false
    private(set) var error: String?
    private(set) var hasLoaded = false
    /// Entries the user explicitly marked unread; suppresses auto-mark-read on collapse.
    private(set) var manuallyUnreadIDs: Set<String> = []

    // Card state (web: EntryCard local state + page-level `expandedId`).
    private(set) var expandedID: String?
    private(set) var summarizing: Set<String> = []
    private(set) var summaryFailures: [String: SummaryFailure] = [:]
    private(set) var fallbackBodies: [String: String] = [:]
    private(set) var loadingFallback: Set<String> = []
    private(set) var scrollRequest: ScrollRequest?

    private var loadGeneration = 0
    private let api: any ARSSAPI
    private let auth: AuthStore
    private let sources: SourcesStore
    private let toasts: ToastCenter
    /// Cloud or on-device summarization, decided per call by the service.
    private let summarizer: any Summarizing
    /// Injectable so tests don't wait the real 4 s in `pollFeed`.
    private let sleep: @Sendable (Duration) async -> Void

    init(
        api: any ARSSAPI,
        auth: AuthStore,
        sources: SourcesStore,
        toasts: ToastCenter,
        summarizer: any Summarizing,
        sleep: @escaping @Sendable (Duration) async -> Void = { try? await Task.sleep(for: $0) }
    ) {
        self.api = api
        self.auth = auth
        self.sources = sources
        self.toasts = toasts
        self.summarizer = summarizer
        self.sleep = sleep
    }

    func entry(id: String) -> Entry? {
        entries.first { $0.id == id }
    }

    // MARK: Scope / order / filter

    /// Sidebar/tab selection. Selecting the already-active scope reloads it (web `reloadIfActive`);
    /// a new scope resets the list and the view's `.task(id:)` performs the load.
    func select(_ scope: FeedScope) {
        if scope == self.scope {
            Task { await loadInitial() }
        } else {
            setScope(scope)
        }
    }

    func setScope(_ scope: FeedScope, order: FeedOrder? = nil) {
        let order = order ?? self.order
        guard scope != self.scope || order != self.order else { return }
        resetCardState()
        self.scope = scope
        self.order = order
        entries = []
        pendingEntries = []
        cursor = nil
        unreadCount = 0
        error = nil
    }

    func toggleOrder() async {
        setScope(scope, order: order == .desc ? .asc : .desc)
        await loadInitial()
    }

    func setFilter(_ filter: Filter) async {
        guard filter != self.filter else { return }
        resetCardState()
        self.filter = filter
        entries = []
        pendingEntries = []
        cursor = nil
        error = nil
        await loadInitial()
    }

    // MARK: Loading

    func loadInitial() async {
        loadGeneration += 1
        let generation = loadGeneration
        loading = true
        error = nil
        entries = []
        pendingEntries = []
        cursor = nil
        do {
            let page = try await fetchPage(cursor: nil)
            guard generation == loadGeneration else { return }
            entries = page.entries
            cursor = page.nextCursor
            unreadCount = page.unreadCount
            hasLoaded = true
        } catch {
            guard generation == loadGeneration else { return }
            auth.noteError(error)
            self.error = error.userMessage(fallback: "Failed to load feed")
        }
        if generation == loadGeneration { loading = false }
    }

    /// Pull-to-refresh: fetch page 1 and swap it in when it arrives. Unlike `loadInitial` the
    /// list stays on screen meanwhile (the refresh control is the progress indicator), and like
    /// `pollFeed` any pending entries are folded in by the replacement.
    func reload() async {
        loadGeneration += 1
        let generation = loadGeneration
        error = nil
        do {
            let page = try await fetchPage(cursor: nil)
            guard generation == loadGeneration else { return }
            resetCardState()
            entries = page.entries
            pendingEntries = []
            cursor = page.nextCursor
            unreadCount = page.unreadCount
            hasLoaded = true
        } catch {
            guard generation == loadGeneration else { return }
            auth.noteError(error)
            self.error = error.userMessage(fallback: "Failed to load feed")
        }
    }

    func loadMore() async {
        guard !loading, let cursor else { return }
        loading = true
        error = nil
        defer { loading = false }
        do {
            let page = try await fetchPage(cursor: cursor)
            entries.append(contentsOf: page.entries)
            self.cursor = page.nextCursor
            unreadCount = page.unreadCount
        } catch {
            auth.noteError(error)
            self.error = error.userMessage(fallback: "Failed to load more")
        }
    }

    /// Passive refresh (60 s tick / foreground): merges page 1 into the visible list in place,
    /// keeping local read state and any summary already loaded, and parks genuinely-new
    /// entries in `pendingEntries`. Never surfaces errors.
    func refresh() async {
        guard hasLoaded, !loading, !polling else { return }
        guard let page = try? await fetchPage(cursor: nil) else { return }
        guard !loading, !polling else { return }

        let incoming = Dictionary(page.entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        entries = entries.map { existing in
            guard var fresh = incoming[existing.id] else { return existing }
            fresh.isRead = existing.isRead
            fresh.summary = existing.summary ?? fresh.summary
            return fresh
        }

        let visibleIDs = Set(entries.map(\.id))
        let pendingIDs = Set(pendingEntries.map(\.id))
        let newlyPending = page.entries.filter { !visibleIDs.contains($0.id) && !pendingIDs.contains($0.id) }
        if !newlyPending.isEmpty {
            pendingEntries = newlyPending + pendingEntries
        }
        unreadCount = page.unreadCount
    }

    func commitPending() {
        guard !pendingEntries.isEmpty else { return }
        entries = pendingEntries + entries
        pendingEntries = []
        scrollRequest = ScrollRequest(target: .top)
    }

    /// The Fetch button: ask the server to poll this view's sources, give Agenda a moment, then
    /// reload page 1 outright (replacing the list and dropping any pending entries).
    func pollFeed() async {
        polling = true
        error = nil
        defer { polling = false }
        do {
            try await api.refreshSources(scope: scope)
            await sleep(.seconds(4))
            let page = try await fetchPage(cursor: nil)
            entries = page.entries
            pendingEntries = []
            cursor = page.nextCursor
            unreadCount = page.unreadCount
            hasLoaded = true
        } catch {
            auth.noteError(error)
            toasts.report(error, fallback: "Fetch failed")
        }
    }

    // MARK: Read state

    @discardableResult
    func toggleRead(_ id: String) async -> Bool {
        guard let index = entries.firstIndex(where: { $0.id == id }) else { return false }
        let wasRead = entries[index].isRead
        let next = !wasRead

        if next { manuallyUnreadIDs.remove(id) } else { manuallyUnreadIDs.insert(id) }
        entries[index].isRead = next
        unreadCount = max(0, unreadCount + (next ? -1 : 1))

        do {
            _ = try await api.setEntryRead(id: id, read: next)
            Task { await sources.refreshUnreadCounts() }
            return next
        } catch {
            if let current = entries.firstIndex(where: { $0.id == id }) {
                entries[current].isRead = wasRead
            }
            unreadCount = max(0, unreadCount + (next ? 1 : -1))
            if !next {
                manuallyUnreadIDs.remove(id)
            } else if !wasRead {
                manuallyUnreadIDs.insert(id)
            }
            auth.noteError(error)
            toasts.report(error, fallback: "Could not update read state")
            return wasRead
        }
    }

    func clearManualUnread(_ id: String) {
        manuallyUnreadIDs.remove(id)
    }

    /// Detail-screen changes flow back into the list (the web leaves them out of sync).
    func applyReadState(id: String, isRead: Bool) {
        guard let index = entries.firstIndex(where: { $0.id == id }), entries[index].isRead != isRead else { return }
        entries[index].isRead = isRead
        unreadCount = max(0, unreadCount + (isRead ? -1 : 1))
    }

    @discardableResult
    func markBulkRead(_ range: BulkMarkReadScope, now: Date = .now) async -> Int {
        do {
            let marked = try await api.markRead(scope: scope, range: range)
            let cutoff: Date = switch range {
            case .all: .distantFuture
            case .olderThan1d: now.addingTimeInterval(-86_400)
            case .olderThan7d: now.addingTimeInterval(-7 * 86_400)
            }
            var updated = entries.map { entry in
                var entry = entry
                if entry.publishedAt <= cutoff { entry.isRead = true }
                return entry
            }
            // In unread-only mode every read row drops out (web filters on `!isRead`).
            if filter == .unread { updated.removeAll(where: \.isRead) }
            entries = updated
            unreadCount = max(0, unreadCount - marked)
            Task { await sources.refreshUnreadCounts() }
            return marked
        } catch {
            auth.noteError(error)
            toasts.report(error, fallback: "Could not mark entries read")
            return 0
        }
    }

    // MARK: Processing

    func retryEntry(_ id: String) async {
        do {
            try await api.retryEntry(id: id)
            if let index = entries.firstIndex(where: { $0.id == id }) {
                entries[index].processingState = .pending
                entries[index].error = nil
            }
        } catch {
            auth.noteError(error)
            toasts.report(error, fallback: "Retry failed")
        }
    }

    /// Cached once present; otherwise one POST. Failures are recorded per entry so the card
    /// can show them inline with a "Try again" gated on `retryable` (never a toast).
    func summarize(_ id: String) async {
        guard let entry = entry(id: id), entry.summary == nil, !summarizing.contains(id) else { return }
        summarizing.insert(id)
        summaryFailures[id] = nil
        defer { summarizing.remove(id) }
        do {
            let response = try await summarizer.summarize(id: id)
            applySummary(id: id, response: response)
        } catch {
            auth.noteError(error)
            summaryFailures[id] = SummaryFailure(
                message: error.userMessage(fallback: "Could not summarize this article."),
                retryable: error.isRetryable,
                code: (error as? APIError)?.code
            )
        }
    }

    func applySummary(id: String, response: SummarizeResponse) {
        guard let index = entries.firstIndex(where: { $0.id == id }) else { return }
        entries[index].summary = response.summary
        entries[index].processingState = response.processingState
    }

    /// The expanded card's fallback body when there's no summary: one detail fetch, and any
    /// failure stores "" so the request is never retried in a loop.
    func loadFallbackBody(_ id: String) async {
        guard fallbackBodies[id] == nil, !loadingFallback.contains(id) else { return }
        loadingFallback.insert(id)
        defer { loadingFallback.remove(id) }
        do {
            let detail = try await api.entryDetail(id: id)
            fallbackBodies[id] = detail.articleText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        } catch {
            fallbackBodies[id] = ""
        }
    }

    // MARK: Expansion

    func toggleExpanded(_ id: String) {
        if expandedID == id {
            collapse()
        } else {
            expand(id)
        }
    }

    /// `force` lets j/k step onto a failed card the way the web's keyboard handler does.
    func expand(_ id: String, force: Bool = false) {
        guard let entry = entry(id: id), entry.canExpand || force else { return }
        if let previous = expandedID, previous != id {
            collapseSideEffects(previous)
            clearCardState(previous)
        }
        expandedID = id
        clearManualUnread(id)
        scrollRequest = ScrollRequest(target: .entry(id))
        if entry.summary == nil, entry.processingState == .fetched {
            Task { await summarize(id) }
        }
    }

    /// Collapse with the web's cleanup semantics: an entry left unread (and not explicitly
    /// marked unread while open) is marked read — "navigated away from".
    func collapse() {
        guard let id = expandedID else { return }
        expandedID = nil
        collapseSideEffects(id)
        clearCardState(id)
    }

    func moveExpansion(by delta: Int) {
        guard !entries.isEmpty else { return }
        let currentIndex = expandedID.flatMap { id in entries.firstIndex { $0.id == id } }
        let target = currentIndex.map { $0 + delta } ?? 0
        let clamped = max(0, min(entries.count - 1, target))
        expand(entries[clamped].id, force: true)
    }

    private func collapseSideEffects(_ id: String) {
        guard let entry = entry(id: id), !manuallyUnreadIDs.contains(id), !entry.isRead else { return }
        Task { await toggleRead(id) }
    }

    private func clearCardState(_ id: String) {
        summaryFailures[id] = nil
        fallbackBodies[id] = nil
        loadingFallback.remove(id)
    }

    /// Scope/filter changes drop the expansion without side effects: on the web the list is
    /// already empty by the time the card's cleanup runs, so nothing gets marked.
    private func resetCardState() {
        expandedID = nil
        summaryFailures = [:]
        fallbackBodies = [:]
        loadingFallback = []
    }

    // MARK: Fetch

    private func fetchPage(cursor: String?) async throws -> FeedResponse {
        try await api.fetchFeed(scope: scope, order: order, unreadOnly: filter == .unread, cursor: cursor)
    }
}
