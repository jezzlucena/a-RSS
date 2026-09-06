import Foundation
import Testing
@testable import aRSS

@Suite("AuthStore")
struct AuthStoreTests {
    @Test func hydrateWithoutASessionIsAnonymous() async {
        let api = FakeARSSAPI()
        let store = AuthStore(api: api)
        await store.hydrate()
        #expect(store.status == .anonymous)
        #expect(store.me == nil)
    }

    @Test func hydrateRestoresThenLoadsMe() async {
        let api = FakeARSSAPI()
        api.restoreSessionResult = true
        let store = AuthStore(api: api)
        await store.hydrate()
        #expect(store.status == .authenticated)
        #expect(store.me?.email == "a@b.com")
        #expect(store.hasPassword)
    }

    @Test func aFailingMeDropsTheSessionAndClearsTheToken() async {
        let api = FakeARSSAPI()
        api.restoreSessionResult = true
        api.meResult = .failure(Make.serverError)
        let store = AuthStore(api: api)
        await store.hydrate()
        #expect(store.status == .anonymous)
        #expect(api.accessTokens == [nil])
    }

    @Test func loginAdoptsTheTokenBeforeAskingForMe() async throws {
        let api = FakeARSSAPI()
        let store = AuthStore(api: api)
        try await store.login(email: "a@b.com", password: "secret123")
        #expect(api.accessTokens == ["access-1"])
        #expect(store.status == .authenticated)
    }

    @Test func loginErrorsPropagateToTheCaller() async {
        let api = FakeARSSAPI()
        api.loginResult = .failure(.http(status: 401, code: "invalid_credentials", message: "Nope", retryable: false))
        let store = AuthStore(api: api)
        await #expect(throws: APIError.self) {
            try await store.login(email: "a@b.com", password: "wrong")
        }
        #expect(store.status == .unknown)
    }

    @Test func logoutClearsLocallyEvenIfTheServerCallFails() async throws {
        let api = FakeARSSAPI()
        let store = AuthStore(api: api)
        try await store.login(email: "a@b.com", password: "secret123")
        await store.logout()
        #expect(api.logoutCalls == 1)
        #expect(store.status == .anonymous)
        #expect(api.accessTokens == ["access-1", nil])
    }

    @Test func llmAccessorsReflectTheActiveProvider() async {
        let api = FakeARSSAPI()
        api.restoreSessionResult = true
        api.meResult = .success(MeResponse(id: "u1", email: "a@b.com", displayName: nil, authMethods: [.magic], llm: Make.llmSettings(active: .gemini, configured: true)))
        let store = AuthStore(api: api)
        await store.hydrate()
        #expect(store.activeProvider?.id == .gemini)
        #expect(store.isLlmConfigured)
    }

    @Test func llmSettingsActionsCallTheApiAndRefetchMe() async throws {
        let api = FakeARSSAPI()
        api.restoreSessionResult = true
        let store = AuthStore(api: api)
        await store.hydrate()
        #expect(!store.isLlmConfigured)

        api.meResult = .success(MeResponse(id: "u1", email: "a@b.com", displayName: nil, authMethods: [.magic], llm: Make.llmSettings(active: .openai, configured: true)))
        try await store.selectLlmProvider(.openai)
        #expect(api.selectProviderCalls == [.openai])
        #expect(store.activeProvider?.id == .openai, "the store re-reads /me after every change")

        try await store.saveLlmCredential(.openai, apiKey: "sk-12345678", model: "", baseUrl: nil)
        let upsert = try #require(api.upsertCalls.last)
        #expect(upsert.id == .openai)
        #expect(upsert.request.apiKey == "sk-12345678")
        #expect(upsert.request.model == .clear, "a blank model resets the override")
        #expect(upsert.request.baseUrl == nil)

        try await store.saveLlmCredential(.custom, apiKey: nil, model: "llama3.1:8b", baseUrl: "http://localhost:11434/v1")
        #expect(api.upsertCalls.last?.request.model == .set("llama3.1:8b"))
        #expect(api.upsertCalls.last?.request.baseUrl == .set("http://localhost:11434/v1"))

        try await store.removeLlmCredential(.openai)
        #expect(api.removeCredentialCalls == [.openai])
    }

    @Test func unauthenticatedErrorsFlipToAnonymous() async throws {
        let api = FakeARSSAPI()
        let store = AuthStore(api: api)
        try await store.login(email: "a@b.com", password: "secret123")
        store.noteError(Make.serverError)
        #expect(store.status == .authenticated)
        store.noteError(APIError.unauthenticated)
        #expect(store.status == .anonymous)
    }
}
