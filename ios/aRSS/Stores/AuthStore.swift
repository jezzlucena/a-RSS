import Foundation

enum AuthStatus: Equatable {
    case unknown, authenticated, anonymous
}

/// Mirrors apps/web/src/stores/auth.ts. The access token lives inside the API client (memory
/// only); the session survives relaunches through the refresh cookie, which `hydrate()`
/// exercises with one silent refresh before asking for `/me`.
@Observable
final class AuthStore {
    private(set) var status: AuthStatus = .unknown
    private(set) var me: MeResponse?

    private let api: any ARSSAPI

    init(api: any ARSSAPI) {
        self.api = api
    }

    var hasPassword: Bool { me?.authMethods.contains(.password) ?? false }
    var llm: LLMSettings? { me?.llm }
    var activeProvider: LLMProviderState? { llm?.active }
    var isLlmConfigured: Bool { activeProvider?.configured ?? false }

    func hydrate() async {
        guard status == .unknown else { return }
        if await api.restoreSession() {
            await fetchMeAndStore()
        } else {
            status = .anonymous
        }
    }

    /// Any `/me` failure drops the session locally (web rule) — the refresh cookie is left
    /// alone, so the next launch can still recover.
    private func fetchMeAndStore() async {
        do {
            me = try await api.me()
            status = .authenticated
        } catch {
            me = nil
            status = .anonymous
            await api.setAccessToken(nil)
        }
    }

    private func adopt(_ tokens: AuthTokensResponse) async {
        await api.setAccessToken(tokens.accessToken)
        await fetchMeAndStore()
    }

    func login(email: String, password: String) async throws {
        await adopt(try await api.login(LoginRequest(email: email, password: password)))
    }

    func signup(email: String, password: String, displayName: String) async throws {
        let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        await adopt(try await api.signup(SignupRequest(email: email, password: password, displayName: name.isEmpty ? nil : name)))
    }

    func requestMagicLink(email: String) async throws {
        try await api.requestMagicLink(email: email)
    }

    func consumeMagicLink(token: String) async throws {
        await adopt(try await api.consumeMagicLink(token: token))
    }

    func signInWithGoogle(idToken: String) async throws {
        await adopt(try await api.signInWithGoogle(idToken: idToken))
    }

    func signInWithApple(_ request: AppleAuthRequest) async throws {
        await adopt(try await api.signInWithApple(request))
    }

    /// The server rotates both tokens, so the response replaces the access token in place.
    func changePassword(newPassword: String, currentPassword: String?) async throws {
        let current = currentPassword?.isEmpty == false ? currentPassword : nil
        await adopt(try await api.changePassword(ChangePasswordRequest(newPassword: newPassword, currentPassword: current)))
    }

    func selectLlmProvider(_ id: LLMProviderID) async throws {
        try await api.selectLlmProvider(id)
        await fetchMeAndStore()
    }

    /// nil leaves a field alone; an empty `model`/`baseUrl` string resets the override.
    func saveLlmCredential(_ id: LLMProviderID, apiKey: String?, model: String?, baseUrl: String?) async throws {
        var request = UpsertLLMCredentialRequest(apiKey: apiKey)
        if let model { request.model = model.isEmpty ? .clear : .set(model) }
        if let baseUrl { request.baseUrl = baseUrl.isEmpty ? .clear : .set(baseUrl) }
        try await api.upsertLlmCredential(id, request)
        await fetchMeAndStore()
    }

    func removeLlmCredential(_ id: LLMProviderID) async throws {
        try await api.removeLlmCredential(id)
        await fetchMeAndStore()
    }

    func reloadMe() async {
        await fetchMeAndStore()
    }

    /// Best-effort server logout (it clears the refresh cookie), then unconditional local reset.
    func logout() async {
        try? await api.logout()
        await api.setAccessToken(nil)
        me = nil
        status = .anonymous
    }

    /// Stores call this with any error they catch; a dead session flips the app to the login
    /// screen instead of leaving a half-working UI behind.
    func noteError(_ error: any Error) {
        guard case .unauthenticated = error as? APIError else { return }
        me = nil
        status = .anonymous
    }
}
