import Foundation

enum APIError: LocalizedError {
    case http(status: Int, code: String?, message: String?)
    case decoding(Error)
    case transport(Error)
    case noResponse

    var errorDescription: String? {
        switch self {
        case .http(_, _, let message): return message ?? "Request failed"
        case .decoding(let err): return "Could not parse response: \(err.localizedDescription)"
        case .transport(let err): return err.localizedDescription
        case .noResponse: return "No response from server"
        }
    }

    var status: Int? {
        if case .http(let s, _, _) = self { return s }
        return nil
    }
}

struct APIErrorBody: Decodable {
    let error: String?
    let message: String?
}

actor APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private var accessToken: String?
    private var refreshTask: Task<String?, Never>?

    init() {
        let bundleURL = Bundle.main.object(forInfoDictionaryKey: "ARSS_API_BASE_URL") as? String
        let resolved = bundleURL?.isEmpty == false ? bundleURL! : "http://localhost:4000/api/v1"
        guard let url = URL(string: resolved) else {
            preconditionFailure("ARSS_API_BASE_URL is invalid: \(resolved)")
        }
        self.baseURL = url

        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    func setAccessToken(_ token: String?) { accessToken = token }

    func currentAccessToken() -> String? { accessToken }

    /// Tries to silently restore the session via the refresh cookie. Returns true on success.
    func tryRestoreSession() async -> Bool {
        let token = await refreshIfPossible()
        return token != nil
    }

    @discardableResult
    private func refreshIfPossible() async -> String? {
        if let existing = refreshTask {
            return await existing.value
        }
        let task = Task<String?, Never> { [weak self] in
            guard let self else { return nil }
            do {
                let tokens: AuthTokensResponse = try await self.requestRaw(
                    path: "/auth/refresh",
                    method: "POST",
                    body: nil as EmptyBody?,
                    retryOnUnauthorized: false
                )
                await self.setAccessToken(tokens.accessToken)
                return tokens.accessToken
            } catch {
                return nil
            }
        }
        refreshTask = task
        let result = await task.value
        refreshTask = nil
        return result
    }

    // MARK: - Public typed helpers

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await requestRaw(path: path, method: "GET", body: nil as EmptyBody?, retryOnUnauthorized: true)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await requestRaw(path: path, method: "POST", body: body, retryOnUnauthorized: true)
    }

    func post<B: Encodable>(_ path: String, body: B) async throws {
        let _: EmptyResponse = try await requestRaw(path: path, method: "POST", body: body, retryOnUnauthorized: true)
    }

    func postEmpty<T: Decodable>(_ path: String) async throws -> T {
        try await requestRaw(path: path, method: "POST", body: nil as EmptyBody?, retryOnUnauthorized: true)
    }

    func postEmpty(_ path: String) async throws {
        let _: EmptyResponse = try await requestRaw(path: path, method: "POST", body: nil as EmptyBody?, retryOnUnauthorized: true)
    }

    // MARK: - Core

    private func requestRaw<T: Decodable, B: Encodable>(
        path: String,
        method: String,
        body: B?,
        retryOnUnauthorized: Bool
    ) async throws -> T {
        var attempt = try await execute(path: path, method: method, body: body)
        if attempt.status == 401, retryOnUnauthorized {
            if let _ = await refreshIfPossible() {
                attempt = try await execute(path: path, method: method, body: body)
            }
        }
        return try decode(response: attempt)
    }

    private struct RawResponse {
        let data: Data
        let status: Int
    }

    private func execute<B: Encodable>(path: String, method: String, body: B?) async throws -> RawResponse {
        let url = baseURL.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw APIError.noResponse }
            return RawResponse(data: data, status: http.statusCode)
        } catch let err as APIError {
            throw err
        } catch {
            throw APIError.transport(error)
        }
    }

    private func decode<T: Decodable>(response: RawResponse) throws -> T {
        if response.status == 204 || response.data.isEmpty {
            if T.self == EmptyResponse.self {
                return EmptyResponse() as! T
            }
            throw APIError.http(status: response.status, code: nil, message: "Empty body")
        }
        if !(200..<300).contains(response.status) {
            let body = try? decoder.decode(APIErrorBody.self, from: response.data)
            throw APIError.http(status: response.status, code: body?.error, message: body?.message ?? body?.error)
        }
        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }
        do {
            return try decoder.decode(T.self, from: response.data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

struct EmptyBody: Encodable {}

struct EmptyResponse: Decodable {
    init() {}
}
