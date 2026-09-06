import Foundation
import Testing
@testable import aRSS

@Suite("APIClient", .serialized)
struct APIClientTests {
    private static let base = URL(string: "http://test.local/api/v1")!

    private func makeClient(token: String? = "old", _ router: @escaping StubURLProtocol.Router) async -> APIClient {
        StubURLProtocol.install(router)
        let client = APIClient(baseURL: Self.base, session: APIClient.makeSession(protocolClasses: [StubURLProtocol.self]), persistsRefreshCookie: false)
        await client.setAccessToken(token)
        return client
    }

    /// `/me` succeeds only with the refreshed token; refresh always hands one out.
    private static let refreshingRouter: StubURLProtocol.Router = { request in
        switch request.path {
        case "/api/v1/auth/refresh": return .init(status: 200, json: Fixtures.tokens)
        case "/api/v1/me":
            return request.authorization == "Bearer new-token"
                ? .init(status: 200, json: Fixtures.me)
                : .init(status: 401, json: Fixtures.invalidToken)
        default: return .init(status: 404, json: "{\"error\":\"not_found\",\"message\":\"Not found\",\"retryable\":false}")
        }
    }

    @Test func buildsURLsUnderTheBasePathWithQueryItems() async throws {
        let client = await makeClient { _ in .init(status: 200, json: Fixtures.lastPage) }
        let _: FeedResponse = try await client.send(Endpoints.feed(scope: .category("abc"), order: .asc, unreadOnly: true, cursor: "c/1"))
        let request = try #require(StubURLProtocol.recorded.first)
        #expect(request.path == "/api/v1/feeds")
        #expect(request.authorization == "Bearer old")
        let query = Dictionary(uniqueKeysWithValues: request.queryItems.map { ($0.name, $0.value ?? "") })
        #expect(query["view"] == "category:abc")
        #expect(query["order"] == "asc")
        #expect(query["limit"] == "30")
        #expect(query["cursor"] == "c/1")
        #expect(query["unread"] == "1")
    }

    @Test func omitsTheUnreadParamForTheAllFilter() async throws {
        let client = await makeClient { _ in .init(status: 200, json: Fixtures.lastPage) }
        let _: FeedResponse = try await client.send(Endpoints.feed(scope: .all, order: .desc, unreadOnly: false, cursor: nil))
        let names = StubURLProtocol.recorded.first?.queryItems.map(\.name) ?? []
        #expect(!names.contains("unread"))
        #expect(!names.contains("cursor"))
    }

    @Test func refreshesOnceAndReplaysOnceAfter401() async throws {
        let client = await makeClient(Self.refreshingRouter)
        let me: MeResponse = try await client.send(Endpoints.me)
        #expect(me.email == "a@b.com")
        let recorded = StubURLProtocol.recorded
        #expect(recorded.map(\.path) == ["/api/v1/me", "/api/v1/auth/refresh", "/api/v1/me"])
        #expect(recorded[1].method == "POST")
        #expect(recorded[2].authorization == "Bearer new-token")
        #expect(await client.currentAccessToken == "new-token")
    }

    @Test func failedRefreshClearsTokenAndThrowsUnauthenticated() async throws {
        let client = await makeClient { request in
            request.path.hasSuffix("/auth/refresh")
                ? .init(status: 401, json: "{\"error\":\"no_refresh\",\"message\":\"No refresh token\",\"retryable\":false}")
                : .init(status: 401, json: Fixtures.invalidToken)
        }
        await #expect(throws: APIError.unauthenticated) {
            let _: MeResponse = try await client.send(Endpoints.me)
        }
        #expect(StubURLProtocol.recorded.map(\.path) == ["/api/v1/me", "/api/v1/auth/refresh"])
        #expect(await client.currentAccessToken == nil)
    }

    @Test func doesNotRefreshWhenRetryIsDisabled() async throws {
        let client = await makeClient { _ in .init(status: 401, json: Fixtures.invalidCredentials) }
        await #expect(throws: APIError.http(status: 401, code: "invalid_credentials", message: "Email or password is incorrect", retryable: false)) {
            let _: AuthTokensResponse = try await client.send(Endpoints.login(LoginRequest(email: "a@b.com", password: "nope")))
        }
        #expect(StubURLProtocol.recorded.count == 1)
    }

    @Test func concurrent401sShareASingleRefresh() async throws {
        let client = await makeClient(Self.refreshingRouter)
        async let first: MeResponse = client.send(Endpoints.me)
        async let second: MeResponse = client.send(Endpoints.me)
        _ = try await (first, second)
        let refreshes = StubURLProtocol.recorded.filter { $0.path.hasSuffix("/auth/refresh") }
        #expect(refreshes.count == 1)
    }

    @Test func validationErrorsFallBackToTheCodeAsMessage() async throws {
        let client = await makeClient { _ in .init(status: 400, json: Fixtures.validationError) }
        await #expect(throws: APIError.http(status: 400, code: "validation_error", message: "Invalid request", retryable: false)) {
            try await client.send(Endpoints.magicRequest(email: "nope"))
        }
    }

    @Test func plainText429BecomesARetryableRateLimitError() async throws {
        let client = await makeClient { _ in .init(status: 429, text: "Too many requests, please try again later.") }
        do {
            let _: MeResponse = try await client.send(Endpoints.me)
            Issue.record("expected an error")
        } catch let error as APIError {
            #expect(error.code == "rate_limited")
            #expect(error.retryable)
            #expect(error.status == 429)
        }
    }

    @Test func noContentResponsesSucceedWithoutDecoding() async throws {
        let client = await makeClient { _ in .noContent }
        try await client.send(Endpoints.removeLlmCredential(.openai))
        #expect(StubURLProtocol.recorded.first?.method == "DELETE")
    }

    @Test func sendsJSONBodiesWithContentType() async throws {
        let client = await makeClient { _ in .init(status: 200, json: Fixtures.source) }
        let _: Source = try await client.send(Endpoints.updateSource(id: "abc", UpdateSourceRequest(categoryId: .clear)))
        let request = try #require(StubURLProtocol.recorded.first)
        #expect(request.method == "PATCH")
        #expect(request.headers["Content-Type"] == "application/json")
        #expect(request.jsonBody?["categoryId"] is NSNull)
    }

    @Test func downloadReturnsRawBytes() async throws {
        let client = await makeClient { _ in .init(status: 200, json: "<opml/>", headers: ["Content-Type": "text/x-opml"]) }
        let data = try await client.download(Endpoints.exportOPML)
        #expect(String(decoding: data, as: UTF8.self) == "<opml/>")
    }
}
