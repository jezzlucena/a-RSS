import Foundation

/// Typed surface over every endpoint the app uses. Stores depend on this protocol, so tests
/// can substitute a fake without a URL stack; `LiveARSSAPI` is the only real implementation.
nonisolated protocol ARSSAPI: Sendable {
    // Session
    func setAccessToken(_ token: String?) async
    func restoreSession() async -> Bool
    func signup(_ request: SignupRequest) async throws -> AuthTokensResponse
    func login(_ request: LoginRequest) async throws -> AuthTokensResponse
    func requestMagicLink(email: String) async throws
    func consumeMagicLink(token: String) async throws -> AuthTokensResponse
    func signInWithGoogle(idToken: String) async throws -> AuthTokensResponse
    func signInWithApple(_ request: AppleAuthRequest) async throws -> AuthTokensResponse
    func changePassword(_ request: ChangePasswordRequest) async throws -> AuthTokensResponse
    func logout() async throws

    // Me
    func me() async throws -> MeResponse
    func selectLlmProvider(_ id: LLMProviderID) async throws
    func upsertLlmCredential(_ id: LLMProviderID, _ request: UpsertLLMCredentialRequest) async throws
    func removeLlmCredential(_ id: LLMProviderID) async throws

    // Feed
    func fetchFeed(scope: FeedScope, order: FeedOrder, unreadOnly: Bool, cursor: String?) async throws -> FeedResponse
    func unreadCounts() async throws -> UnreadCounts
    func markRead(scope: FeedScope, range: BulkMarkReadScope) async throws -> Int

    // Entries
    func entryDetail(id: String) async throws -> EntryDetail
    func setEntryRead(id: String, read: Bool) async throws -> Bool
    func retryEntry(id: String) async throws
    func summarize(id: String) async throws -> SummarizeResponse
    func uploadSummary(id: String, _ request: ClientSummaryRequest) async throws -> SummarizeResponse
    func failures() async throws -> [FailedEntry]

    // Sources
    func sources() async throws -> [Source]
    func createSource(_ request: CreateSourceRequest) async throws -> Source
    func updateSource(id: String, _ request: UpdateSourceRequest) async throws -> Source
    func deleteSource(id: String) async throws
    func refreshSources(scope: FeedScope) async throws
    func refreshSource(id: String) async throws -> Source

    // Categories
    func categories() async throws -> [Category]
    func createCategory(_ request: CreateCategoryRequest) async throws -> Category
    func updateCategory(id: String, _ request: UpdateCategoryRequest) async throws -> Category
    func deleteCategory(id: String) async throws

    // OPML
    func importOPML(xml: String) async throws -> OPMLImportResult
    func exportOPML() async throws -> Data
}

nonisolated final class LiveARSSAPI: ARSSAPI {
    let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func setAccessToken(_ token: String?) async { await client.setAccessToken(token) }
    func restoreSession() async -> Bool { await client.tryRestoreSession() }
    func signup(_ request: SignupRequest) async throws -> AuthTokensResponse { try await client.send(Endpoints.signup(request)) }
    func login(_ request: LoginRequest) async throws -> AuthTokensResponse { try await client.send(Endpoints.login(request)) }
    func requestMagicLink(email: String) async throws { try await client.send(Endpoints.magicRequest(email: email)) }
    func consumeMagicLink(token: String) async throws -> AuthTokensResponse { try await client.send(Endpoints.magicConsume(token: token)) }
    func signInWithGoogle(idToken: String) async throws -> AuthTokensResponse { try await client.send(Endpoints.google(idToken: idToken)) }
    func signInWithApple(_ request: AppleAuthRequest) async throws -> AuthTokensResponse { try await client.send(Endpoints.apple(request)) }
    func changePassword(_ request: ChangePasswordRequest) async throws -> AuthTokensResponse { try await client.send(Endpoints.changePassword(request)) }
    func logout() async throws { try await client.send(Endpoints.logout) }

    func me() async throws -> MeResponse { try await client.send(Endpoints.me) }
    func selectLlmProvider(_ id: LLMProviderID) async throws { try await client.send(Endpoints.selectLlmProvider(id)) }
    func upsertLlmCredential(_ id: LLMProviderID, _ request: UpsertLLMCredentialRequest) async throws { try await client.send(Endpoints.upsertLlmCredential(id, request)) }
    func removeLlmCredential(_ id: LLMProviderID) async throws { try await client.send(Endpoints.removeLlmCredential(id)) }

    func fetchFeed(scope: FeedScope, order: FeedOrder, unreadOnly: Bool, cursor: String?) async throws -> FeedResponse {
        try await client.send(Endpoints.feed(scope: scope, order: order, unreadOnly: unreadOnly, cursor: cursor))
    }
    func unreadCounts() async throws -> UnreadCounts { try await client.send(Endpoints.unreadCounts) }
    func markRead(scope: FeedScope, range: BulkMarkReadScope) async throws -> Int {
        let response: BulkMarkReadResponse = try await client.send(Endpoints.markRead(scope: scope, range: range))
        return response.marked
    }

    func entryDetail(id: String) async throws -> EntryDetail { try await client.send(Endpoints.entry(id: id)) }
    func setEntryRead(id: String, read: Bool) async throws -> Bool {
        let response: SetEntryReadResponse = try await client.send(Endpoints.setEntryRead(id: id, read: read))
        return response.isRead
    }
    func retryEntry(id: String) async throws { try await client.send(Endpoints.retryEntry(id: id)) }
    func summarize(id: String) async throws -> SummarizeResponse { try await client.send(Endpoints.summarize(id: id)) }
    func uploadSummary(id: String, _ request: ClientSummaryRequest) async throws -> SummarizeResponse { try await client.send(Endpoints.uploadSummary(id: id, request)) }
    func failures() async throws -> [FailedEntry] {
        let response: FailuresResponse = try await client.send(Endpoints.failures)
        return response.items
    }

    func sources() async throws -> [Source] { try await client.send(Endpoints.sources) }
    func createSource(_ request: CreateSourceRequest) async throws -> Source { try await client.send(Endpoints.createSource(request)) }
    func updateSource(id: String, _ request: UpdateSourceRequest) async throws -> Source { try await client.send(Endpoints.updateSource(id: id, request)) }
    func deleteSource(id: String) async throws { try await client.send(Endpoints.deleteSource(id: id)) }
    func refreshSources(scope: FeedScope) async throws { try await client.send(Endpoints.refreshSources(scope: scope)) }
    func refreshSource(id: String) async throws -> Source { try await client.send(Endpoints.refreshSource(id: id)) }

    func categories() async throws -> [Category] { try await client.send(Endpoints.categories) }
    func createCategory(_ request: CreateCategoryRequest) async throws -> Category { try await client.send(Endpoints.createCategory(request)) }
    func updateCategory(id: String, _ request: UpdateCategoryRequest) async throws -> Category { try await client.send(Endpoints.updateCategory(id: id, request)) }
    func deleteCategory(id: String) async throws { try await client.send(Endpoints.deleteCategory(id: id)) }

    func importOPML(xml: String) async throws -> OPMLImportResult { try await client.send(Endpoints.importOPML(xml: xml)) }
    func exportOPML() async throws -> Data { try await client.download(Endpoints.exportOPML) }
}
