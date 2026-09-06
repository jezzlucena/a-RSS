import Foundation

/// One builder per API route. Auth routes that mint or revoke sessions disable the
/// 401 → refresh → replay path (parity with apps/web/src/stores/auth.ts).
nonisolated enum Endpoints {
    static let pageLimit = 30

    // MARK: Auth
    static func signup(_ body: SignupRequest) throws -> APIRequest { try .post("/auth/signup", body: body, retryOnUnauthorized: false) }
    static func login(_ body: LoginRequest) throws -> APIRequest { try .post("/auth/login", body: body, retryOnUnauthorized: false) }
    static func magicRequest(email: String) throws -> APIRequest { try .post("/auth/magic/request", body: MagicRequest(email: email), retryOnUnauthorized: false) }
    static func magicConsume(token: String) throws -> APIRequest { try .post("/auth/magic/consume", body: MagicConsumeRequest(token: token), retryOnUnauthorized: false) }
    static func google(idToken: String) throws -> APIRequest { try .post("/auth/google", body: GoogleAuthRequest(idToken: idToken), retryOnUnauthorized: false) }
    static func apple(_ body: AppleAuthRequest) throws -> APIRequest { try .post("/auth/apple", body: body, retryOnUnauthorized: false) }
    static func changePassword(_ body: ChangePasswordRequest) throws -> APIRequest { try .post("/auth/change-password", body: body) }
    static var logout: APIRequest { .post("/auth/logout", retryOnUnauthorized: false) }

    // MARK: Me
    static var me: APIRequest { .get("/me") }
    static func selectLlmProvider(_ id: LLMProviderID) throws -> APIRequest { try .put("/me/llm", body: SelectLLMProviderRequest(provider: id)) }
    static func upsertLlmCredential(_ id: LLMProviderID, _ body: UpsertLLMCredentialRequest) throws -> APIRequest { try .put("/me/llm/\(id.rawValue)", body: body) }
    static func removeLlmCredential(_ id: LLMProviderID) -> APIRequest { .delete("/me/llm/\(id.rawValue)") }

    // MARK: Feeds
    static func feed(scope: FeedScope, order: FeedOrder, unreadOnly: Bool, cursor: String?) -> APIRequest {
        var query = [
            URLQueryItem(name: "view", value: scope.queryValue),
            URLQueryItem(name: "order", value: order.rawValue),
            URLQueryItem(name: "limit", value: String(pageLimit)),
        ]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        // The server coerces any non-empty string to true (`unread=false` means unread!),
        // so the parameter is only ever present for the unread filter.
        if unreadOnly { query.append(URLQueryItem(name: "unread", value: "1")) }
        return .get("/feeds", query: query)
    }
    static var unreadCounts: APIRequest { .get("/feeds/unread-counts") }
    static func markRead(scope: FeedScope, range: BulkMarkReadScope) throws -> APIRequest {
        try .post("/feeds/mark-read", body: BulkMarkReadRequest(view: scope.queryValue, scope: range))
    }

    // MARK: Entries
    static var failures: APIRequest { .get("/entries/failures") }
    static func entry(id: String) -> APIRequest { .get("/entries/\(id)") }
    static func setEntryRead(id: String, read: Bool) throws -> APIRequest { try .post("/entries/\(id)/read", body: SetEntryReadRequest(read: read)) }
    static func retryEntry(id: String) -> APIRequest { .post("/entries/\(id)/retry") }
    static func summarize(id: String) -> APIRequest { .post("/entries/\(id)/summarize") }
    /// Stores a client-produced summary; the server keeps an existing one instead (idempotent).
    static func uploadSummary(id: String, _ body: ClientSummaryRequest) throws -> APIRequest { try .put("/entries/\(id)/summary", body: body) }

    // MARK: Sources
    static var sources: APIRequest { .get("/sources") }
    static func createSource(_ body: CreateSourceRequest) throws -> APIRequest { try .post("/sources", body: body) }
    static func updateSource(id: String, _ body: UpdateSourceRequest) throws -> APIRequest { try .patch("/sources/\(id)", body: body) }
    static func deleteSource(id: String) -> APIRequest { .delete("/sources/\(id)") }
    /// Bulk refresh for a view; the server enqueues polls and answers 202 immediately.
    static func refreshSources(scope: FeedScope) throws -> APIRequest { try .post("/sources/refresh", body: RefreshSourcesRequest(view: scope.queryValue)) }
    /// Single-source refresh runs the poll synchronously and returns the updated source.
    static func refreshSource(id: String) -> APIRequest { .post("/sources/\(id)/refresh") }

    // MARK: Categories
    static var categories: APIRequest { .get("/categories") }
    static func createCategory(_ body: CreateCategoryRequest) throws -> APIRequest { try .post("/categories", body: body) }
    static func updateCategory(id: String, _ body: UpdateCategoryRequest) throws -> APIRequest { try .patch("/categories/\(id)", body: body) }
    static func deleteCategory(id: String) -> APIRequest { .delete("/categories/\(id)") }

    // MARK: OPML
    static func importOPML(xml: String) throws -> APIRequest { try .post("/opml/import", body: OPMLImportRequest(xml: xml)) }
    static var exportOPML: APIRequest {
        var request = APIRequest.get("/opml/export")
        request.accept = "text/x-opml, application/xml, text/xml, */*"
        return request
    }
}
