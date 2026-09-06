import Foundation

/// HTTP transport for the a-RSS API. Owns the in-memory access token (never persisted —
/// same as the web client's module-level variable) and the single-flight refresh.
///
/// The refresh token is an httpOnly cookie (`arss_refresh`, Path=/api/v1/auth) that the
/// server rotates on every refresh; `HTTPCookieStorage.shared` persists it across launches
/// and attaches it to `POST /auth/refresh` automatically, which is how a cold start
/// restores the session without any Keychain code.
actor APIClient {
    nonisolated let baseURL: URL
    private let session: URLSession
    /// Mirrors the refresh cookie into the Keychain (see `RefreshCookieVault`). Off in tests.
    private let persistsRefreshCookie: Bool
    private var accessToken: String?
    private var refreshTask: Task<String?, Never>?

    init(baseURL: URL, session: URLSession? = nil, persistsRefreshCookie: Bool = true) {
        self.baseURL = baseURL
        self.session = session ?? APIClient.makeSession()
        self.persistsRefreshCookie = persistsRefreshCookie
    }

    /// The cookie's scope: `Path=/api/v1/auth`, so any URL under `/auth/` matches.
    private nonisolated var authCookieURL: URL { baseURL.appending(path: "auth/refresh") }

    /// `protocolClasses` lets tests plug in a `URLProtocol` stub without touching global state.
    nonisolated static func makeSession(protocolClasses: [AnyClass]? = nil) -> URLSession {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.waitsForConnectivity = false
        if let protocolClasses { config.protocolClasses = protocolClasses }
        return URLSession(configuration: config)
    }

    // MARK: Token

    func setAccessToken(_ token: String?) {
        accessToken = token
    }

    var currentAccessToken: String? { accessToken }

    /// Silent session restore on launch: one refresh against the cookie. Mirrors the web's
    /// `tryRestoreSession()`.
    func tryRestoreSession() async -> Bool {
        restoreRefreshCookieFromVault()
        return await refresh() != nil
    }

    // MARK: Requests

    func send<T: Decodable & Sendable>(_ request: APIRequest) async throws -> T {
        let (data, _) = try await perform(request)
        do {
            return try JSONCoding.makeDecoder().decode(T.self, from: data)
        } catch let error as DecodingError {
            throw APIError.decoding(Self.describe(error))
        }
    }

    /// For 204 / body-less responses, and responses whose body the caller doesn't need.
    func send(_ request: APIRequest) async throws {
        _ = try await perform(request)
    }

    /// Raw bytes (the OPML export is XML, not JSON) through the same auth + refresh path.
    func download(_ request: APIRequest) async throws -> Data {
        try await perform(request).0
    }

    // MARK: Internals

    private func perform(_ request: APIRequest) async throws -> (Data, HTTPURLResponse) {
        var (data, response) = try await execute(request)
        if request.path.hasPrefix("/auth/") {
            syncRefreshCookieToVault(afterLogout: request.path == "/auth/logout")
        }
        if response.statusCode == 401, request.retryOnUnauthorized {
            // One refresh, one replay — never recursive.
            if await refresh() != nil {
                (data, response) = try await execute(request)
            }
            if response.statusCode == 401 {
                accessToken = nil
                throw APIError.unauthenticated
            }
        }
        guard (200..<300).contains(response.statusCode) else {
            throw Self.makeError(status: response.statusCode, data: data)
        }
        return (data, response)
    }

    private func execute(_ request: APIRequest) async throws -> (Data, HTTPURLResponse) {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.transport("Invalid base URL \(baseURL)")
        }
        let basePath = components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path
        let relative = request.path.hasPrefix("/") ? request.path : "/" + request.path
        components.path = basePath + relative
        components.queryItems = request.query.isEmpty ? nil : request.query
        guard let url = components.url else {
            throw APIError.transport("Could not build URL for \(request.path)")
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = request.method.rawValue
        urlRequest.setValue(request.accept, forHTTPHeaderField: "Accept")
        if let body = request.body {
            urlRequest.httpBody = body
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let accessToken {
            urlRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await session.data(for: urlRequest)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.transport("Not an HTTP response")
            }
            return (data, http)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
    }

    /// Single-flight: concurrent 401s share one `POST /auth/refresh`, exactly like the web
    /// client's `refreshPromise`. Returns the new access token or nil.
    private func refresh() async -> String? {
        if let inFlight = refreshTask {
            return await inFlight.value
        }
        let task = Task<String?, Never> {
            do {
                let (data, response) = try await execute(.post("/auth/refresh", retryOnUnauthorized: false))
                guard (200..<300).contains(response.statusCode) else {
                    // The server clears the cookie on a rejected refresh; drop our mirror too.
                    if response.statusCode == 401 { syncRefreshCookieToVault(afterLogout: true) }
                    return nil
                }
                let tokens = try JSONCoding.makeDecoder().decode(AuthTokensResponse.self, from: data)
                accessToken = tokens.accessToken
                syncRefreshCookieToVault(afterLogout: false)
                return tokens.accessToken
            } catch {
                return nil
            }
        }
        refreshTask = task
        let token = await task.value
        refreshTask = nil
        return token
    }

    // MARK: Refresh cookie persistence

    private var storedRefreshCookie: HTTPCookie? {
        session.configuration.httpCookieStorage?.cookies(for: authCookieURL)?.first { $0.name == RefreshCookieVault.cookieName }
    }

    private func syncRefreshCookieToVault(afterLogout: Bool) {
        guard persistsRefreshCookie else { return }
        if afterLogout {
            RefreshCookieVault.clear()
            return
        }
        if let cookie = storedRefreshCookie {
            RefreshCookieVault.save(cookie)
        }
    }

    /// Before the launch refresh: if the Keychain holds a newer cookie than the store, seed it.
    private func restoreRefreshCookieFromVault() {
        guard persistsRefreshCookie, let vaulted = RefreshCookieVault.load(), let storage = session.configuration.httpCookieStorage else { return }
        if let current = storedRefreshCookie, current.value == vaulted.value { return }
        storage.setCookie(vaulted)
    }

    nonisolated private static func makeError(status: Int, data: Data) -> APIError {
        if let body = try? JSONCoding.makeDecoder().decode(APIErrorBody.self, from: data) {
            // validation_error carries `details` but no `message`; fall back to the code,
            // which is what the web's ApiError does too.
            let message = body.message ?? (body.error == "validation_error" ? "Invalid request" : body.error)
            return .http(status: status, code: body.error, message: message, retryable: body.retryable ?? (status >= 500))
        }
        // express-rate-limit answers 429 with a plain-text body, not the JSON envelope.
        if status == 429 {
            return .http(status: 429, code: "rate_limited", message: "Too many requests. Wait a moment and try again.", retryable: true)
        }
        let text = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        let message = text.isEmpty || text.count > 200 ? "Request failed (\(status))" : text
        return .http(status: status, code: "http_\(status)", message: message, retryable: status >= 500)
    }

    nonisolated private static func describe(_ error: DecodingError) -> String {
        switch error {
        case .keyNotFound(let key, let ctx): "missing key \(key.stringValue) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))"
        case .typeMismatch(let type, let ctx): "type mismatch for \(type) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))"
        case .valueNotFound(let type, let ctx): "null \(type) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))"
        case .dataCorrupted(let ctx): ctx.debugDescription
        @unknown default: String(describing: error)
        }
    }
}
