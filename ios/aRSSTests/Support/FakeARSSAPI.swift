import Foundation
@testable import aRSS

/// In-memory `ARSSAPI` for store tests: canned results per method plus a call log. Main-actor
/// isolated like the stores, so tests can poke its state directly.
@MainActor
final class FakeARSSAPI: ARSSAPI {
    struct FeedCall: Equatable {
        let scope: FeedScope
        let order: FeedOrder
        let unreadOnly: Bool
        let cursor: String?
    }

    // Session
    var restoreSessionResult = false
    var accessTokens: [String?] = []
    var meResult: Result<MeResponse, APIError> = .success(FakeARSSAPI.defaultMe)
    var selectProviderCalls: [LLMProviderID] = []
    var upsertCalls: [(id: LLMProviderID, request: UpsertLLMCredentialRequest)] = []
    var removeCredentialCalls: [LLMProviderID] = []
    var loginResult: Result<AuthTokensResponse, APIError> = .success(AuthTokensResponse(accessToken: "access-1", expiresIn: 900))
    var logoutCalls = 0

    // Feed
    var feedPages: [Result<FeedResponse, APIError>] = []
    var feedCalls: [FeedCall] = []
    var unreadCountsResult: Result<UnreadCounts, APIError> = .success(.empty)
    var unreadCountsCalls = 0
    var markReadResult: Result<Int, APIError> = .success(0)
    var markReadCalls: [(FeedScope, BulkMarkReadScope)] = []

    // Entries
    var setEntryReadResult: Result<Bool, APIError> = .success(true)
    var readCalls: [(id: String, read: Bool)] = []
    var retryError: APIError?
    var retryCalls: [String] = []
    var summarizeResults: [String: Result<SummarizeResponse, APIError>] = [:]
    var summarizeCalls: [String] = []
    var uploadSummaryCalls: [(id: String, request: ClientSummaryRequest)] = []
    /// nil echoes the uploaded summary back as `.summarized` (what the server does).
    var uploadSummaryResult: Result<SummarizeResponse, APIError>?
    var detailResults: [String: Result<EntryDetail, APIError>] = [:]
    var detailCalls: [String] = []
    var refreshSourcesError: APIError?
    var refreshSourcesCalls: [FeedScope] = []

    // Sources / categories
    var categoriesResult: Result<[aRSS.Category], APIError> = .success([])
    var sourcesResult: Result<[Source], APIError> = .success([])
    var nextID = 1

    static let defaultMe = MeResponse(id: "u1", email: "a@b.com", displayName: nil, authMethods: [.password, .magic], llm: Make.llmSettings(active: .anthropic, configured: false))

    private func nextFeedPage() throws -> FeedResponse {
        guard !feedPages.isEmpty else { return FeedResponse(entries: [], nextCursor: nil, unreadCount: 0) }
        let page = feedPages.count > 1 ? feedPages.removeFirst() : feedPages[0]
        return try page.get()
    }

    // MARK: ARSSAPI

    @MainActor func setAccessToken(_ token: String?) async { accessTokens.append(token) }
    @MainActor func restoreSession() async -> Bool { restoreSessionResult }
    @MainActor func signup(_ request: SignupRequest) async throws -> AuthTokensResponse { try loginResult.get() }
    @MainActor func login(_ request: LoginRequest) async throws -> AuthTokensResponse { try loginResult.get() }
    @MainActor func requestMagicLink(email: String) async throws {}
    @MainActor func consumeMagicLink(token: String) async throws -> AuthTokensResponse { try loginResult.get() }
    @MainActor func signInWithGoogle(idToken: String) async throws -> AuthTokensResponse { try loginResult.get() }
    @MainActor func signInWithApple(_ request: AppleAuthRequest) async throws -> AuthTokensResponse { try loginResult.get() }
    @MainActor func changePassword(_ request: ChangePasswordRequest) async throws -> AuthTokensResponse { try loginResult.get() }
    @MainActor func logout() async throws { logoutCalls += 1 }

    @MainActor func me() async throws -> MeResponse { try meResult.get() }
    @MainActor func selectLlmProvider(_ id: LLMProviderID) async throws { selectProviderCalls.append(id) }
    @MainActor func upsertLlmCredential(_ id: LLMProviderID, _ request: UpsertLLMCredentialRequest) async throws { upsertCalls.append((id, request)) }
    @MainActor func removeLlmCredential(_ id: LLMProviderID) async throws { removeCredentialCalls.append(id) }

    @MainActor func fetchFeed(scope: FeedScope, order: FeedOrder, unreadOnly: Bool, cursor: String?) async throws -> FeedResponse {
        feedCalls.append(FeedCall(scope: scope, order: order, unreadOnly: unreadOnly, cursor: cursor))
        return try nextFeedPage()
    }

    @MainActor func unreadCounts() async throws -> UnreadCounts {
        unreadCountsCalls += 1
        return try unreadCountsResult.get()
    }

    @MainActor func markRead(scope: FeedScope, range: BulkMarkReadScope) async throws -> Int {
        markReadCalls.append((scope, range))
        return try markReadResult.get()
    }

    @MainActor func entryDetail(id: String) async throws -> EntryDetail {
        detailCalls.append(id)
        guard let result = detailResults[id] else { throw APIError.http(status: 404, code: "not_found", message: "Not found", retryable: false) }
        return try result.get()
    }

    @MainActor func setEntryRead(id: String, read: Bool) async throws -> Bool {
        readCalls.append((id, read))
        return try setEntryReadResult.get()
    }

    @MainActor func retryEntry(id: String) async throws {
        retryCalls.append(id)
        if let retryError { throw retryError }
    }

    @MainActor func summarize(id: String) async throws -> SummarizeResponse {
        summarizeCalls.append(id)
        guard let result = summarizeResults[id] else { throw APIError.http(status: 409, code: "not_ready", message: "Not ready", retryable: true) }
        return try result.get()
    }

    @MainActor func uploadSummary(id: String, _ request: ClientSummaryRequest) async throws -> SummarizeResponse {
        uploadSummaryCalls.append((id, request))
        if let uploadSummaryResult { return try uploadSummaryResult.get() }
        let summary = EntrySummary(intro: request.intro, bullets: request.bullets, model: request.model, generatedAt: .now)
        return SummarizeResponse(summary: summary, processingState: .summarized)
    }

    @MainActor func failures() async throws -> [FailedEntry] { [] }

    @MainActor func sources() async throws -> [Source] { try sourcesResult.get() }

    @MainActor func createSource(_ request: CreateSourceRequest) async throws -> Source {
        defer { nextID += 1 }
        return Source(id: "src-\(nextID)", feedUrl: request.feedUrl, siteUrl: nil, title: request.feedUrl, categoryId: request.categoryId, pollIntervalMs: 1_800_000, bypassStrategy: request.bypassStrategy ?? .default, lastPolledAt: nil)
    }

    @MainActor func updateSource(id: String, _ request: UpdateSourceRequest) async throws -> Source {
        guard var source = try sourcesResult.get().first(where: { $0.id == id }) else { throw APIError.http(status: 404, code: "not_found", message: "Not found", retryable: false) }
        if let feedUrl = request.feedUrl { source.feedUrl = feedUrl }
        if let title = request.title { source.title = title }
        if let strategy = request.bypassStrategy { source.bypassStrategy = strategy }
        switch request.categoryId {
        case .set(let categoryId): source.categoryId = categoryId
        case .clear: source.categoryId = nil
        case nil: break
        }
        return source
    }

    @MainActor func deleteSource(id: String) async throws {}

    @MainActor func refreshSources(scope: FeedScope) async throws {
        refreshSourcesCalls.append(scope)
        if let refreshSourcesError { throw refreshSourcesError }
    }

    @MainActor func refreshSource(id: String) async throws -> Source {
        guard let source = try sourcesResult.get().first(where: { $0.id == id }) else { throw APIError.http(status: 404, code: "not_found", message: "Not found", retryable: false) }
        return source
    }

    @MainActor func categories() async throws -> [aRSS.Category] { try categoriesResult.get() }

    @MainActor func createCategory(_ request: CreateCategoryRequest) async throws -> aRSS.Category {
        defer { nextID += 1 }
        return aRSS.Category(id: "cat-\(nextID)", name: request.name, color: request.color)
    }

    @MainActor func updateCategory(id: String, _ request: UpdateCategoryRequest) async throws -> aRSS.Category {
        guard var category = try categoriesResult.get().first(where: { $0.id == id }) else { throw APIError.http(status: 404, code: "not_found", message: "Not found", retryable: false) }
        if let name = request.name { category.name = name }
        if let color = request.color { category.color = color }
        return category
    }

    @MainActor func deleteCategory(id: String) async throws {}

    @MainActor func importOPML(xml: String) async throws -> OPMLImportResult { OPMLImportResult(importedCategories: 0, importedSources: 0, skippedSources: 0) }
    @MainActor func exportOPML() async throws -> Data { Data("<opml/>".utf8) }
}

// MARK: - Builders

enum Make {
    static func entry(
        _ id: String,
        read: Bool = false,
        publishedAt: Date = .now,
        summary: EntrySummary? = nil,
        state: ProcessingState = .fetched
    ) -> Entry {
        Entry(
            id: id, sourceId: "src-1", sourceTitle: "Source", categoryId: nil, url: "https://example.com/\(id)",
            title: "Entry \(id)", publishedAt: publishedAt, description: nil, summary: summary, image: nil,
            processingState: state, isRead: read, error: nil
        )
    }

    static let summary = EntrySummary(intro: "Intro", bullets: ["a", "b", "c"], model: "test", generatedAt: .now)

    static func page(_ entries: [Entry], cursor: String? = nil, unread: Int = 0) -> Result<FeedResponse, APIError> {
        .success(FeedResponse(entries: entries, nextCursor: cursor, unreadCount: unread))
    }

    static func source(_ id: String, title: String, categoryId: String? = nil) -> Source {
        Source(id: id, feedUrl: "https://example.com/\(id).xml", siteUrl: nil, title: title, categoryId: categoryId, pollIntervalMs: 1_800_000, bypassStrategy: .default, lastPolledAt: nil)
    }

    static let serverError = APIError.http(status: 500, code: "internal_error", message: "Boom", retryable: true)

    static func providerState(_ id: LLMProviderID, configured: Bool, model: String? = nil, baseUrl: String? = nil) -> LLMProviderState {
        LLMProviderState(
            id: id, label: id.rawValue.capitalized, shortLabel: id.rawValue.capitalized,
            transport: id == .anthropic ? .anthropic : .openaiCompatible, configured: configured,
            model: model, defaultModel: id == .custom ? nil : "\(id.rawValue)-default", baseUrl: baseUrl,
            defaultBaseUrl: id == .anthropic || id == .custom ? nil : "https://\(id.rawValue).example/v1",
            keyPlaceholder: "sk-…", consoleUrl: nil, requiresKey: id != .custom
        )
    }

    /// Every real provider, with only `active` marked configured when requested.
    static func llmSettings(active: LLMProviderID, configured: Bool) -> LLMSettings {
        LLMSettings(provider: active, providers: LLMProviderID.knownCases.map { providerState($0, configured: configured && $0 == active) })
    }

    static func detail(_ id: String, state: ProcessingState = .fetched, articleText: String? = String(repeating: "word ", count: 80), summary: EntrySummary? = nil) -> EntryDetail {
        EntryDetail(
            id: id, sourceId: "src-1", sourceTitle: "Source", categoryId: nil, url: "https://example.com/\(id)", title: "Entry \(id)",
            publishedAt: .now, description: nil, summary: summary, image: nil, processingState: state, isRead: false, error: nil,
            articleText: articleText, byline: "By Someone"
        )
    }
}

/// Stand-in for FoundationModels in unit tests.
@MainActor
final class FakeOnDeviceEngine: OnDeviceSummarizing {
    var availability: OnDeviceAvailability = .available
    var result: Result<OnDeviceSummary, OnDeviceError> = .success(OnDeviceSummary(intro: "On-device intro.", bullets: ["one", "two", "three"]))
    var calls: [(title: String, byline: String?, articleText: String)] = []

    func summarize(title: String, byline: String?, articleText: String) async throws -> OnDeviceSummary {
        calls.append((title, byline, articleText))
        return try result.get()
    }
}

extension Make {
    static func isolatedDefaults() -> UserDefaults {
        let suite = "aRSSTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

    /// A cloud-only summarization service (preference off) for stores that just need one.
    static func summarizer(api: FakeARSSAPI, auth: AuthStore) -> SummarizationService {
        SummarizationService(api: api, auth: auth, preferences: SummarizationPreferences(defaults: isolatedDefaults()), engine: FakeOnDeviceEngine())
    }
}

/// Lets fire-and-forget `Task {}`s spawned by the stores run to completion.
func settle() async {
    for _ in 0..<20 { await Task.yield() }
}
