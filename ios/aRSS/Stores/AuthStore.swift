import Foundation
import Observation

enum AuthStatus {
    case unknown
    case authenticated
    case anonymous
}

@Observable
@MainActor
final class AuthStore {
    var status: AuthStatus = .unknown
    var me: MeResponse?
    var lastError: String?

    private let api: APIClient = .shared

    func hydrate() async {
        let restored = await api.tryRestoreSession()
        if restored {
            await fetchMe()
        } else {
            status = .anonymous
        }
    }

    private func fetchMe() async {
        do {
            let me: MeResponse = try await api.get("/me")
            self.me = me
            self.status = .authenticated
        } catch {
            self.me = nil
            self.status = .anonymous
            await api.setAccessToken(nil)
        }
    }

    func signup(email: String, password: String, displayName: String?) async {
        lastError = nil
        do {
            let tokens: AuthTokensResponse = try await api.post(
                "/auth/signup",
                body: SignupRequest(email: email, password: password, displayName: displayName)
            )
            await api.setAccessToken(tokens.accessToken)
            await fetchMe()
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func login(email: String, password: String) async {
        lastError = nil
        do {
            let tokens: AuthTokensResponse = try await api.post(
                "/auth/login",
                body: LoginRequest(email: email, password: password)
            )
            await api.setAccessToken(tokens.accessToken)
            await fetchMe()
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func requestMagic(email: String) async -> Bool {
        lastError = nil
        do {
            try await api.post("/auth/magic/request", body: MagicRequest(email: email))
            return true
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return false
        }
    }

    func consumeMagic(token: String) async -> Bool {
        lastError = nil
        do {
            let tokens: AuthTokensResponse = try await api.post(
                "/auth/magic/consume",
                body: MagicConsumeRequest(token: token)
            )
            await api.setAccessToken(tokens.accessToken)
            await fetchMe()
            return status == .authenticated
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return false
        }
    }

    func loginWithGoogle(idToken: String) async {
        lastError = nil
        struct GoogleAuthRequest: Codable { let idToken: String }
        do {
            let tokens: AuthTokensResponse = try await api.post(
                "/auth/google",
                body: GoogleAuthRequest(idToken: idToken)
            )
            await api.setAccessToken(tokens.accessToken)
            await fetchMe()
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loginWithApple(
        identityToken: String,
        email: String?,
        givenName: String?,
        familyName: String?
    ) async {
        lastError = nil
        struct FullName: Codable {
            let givenName: String?
            let familyName: String?
        }
        struct AppleAuthRequest: Codable {
            let identityToken: String
            let email: String?
            let fullName: FullName?
        }
        let fullName: FullName? =
            (givenName != nil || familyName != nil)
                ? FullName(givenName: givenName, familyName: familyName)
                : nil
        do {
            let tokens: AuthTokensResponse = try await api.post(
                "/auth/apple",
                body: AppleAuthRequest(identityToken: identityToken, email: email, fullName: fullName)
            )
            await api.setAccessToken(tokens.accessToken)
            await fetchMe()
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func logout() async {
        do { try await api.postEmpty("/auth/logout") } catch { /* best effort */ }
        await api.setAccessToken(nil)
        me = nil
        status = .anonymous
    }
}
