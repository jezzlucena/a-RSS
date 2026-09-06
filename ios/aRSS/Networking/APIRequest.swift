import Foundation

nonisolated enum HTTPMethod: String, Sendable {
    case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE"
}

/// A transport-agnostic description of one API call. Paths are relative to the client's
/// base URL (`/feeds`, not `/api/v1/feeds`); query parameters are real `URLQueryItem`s so
/// they're percent-encoded properly instead of being smuggled through the path.
nonisolated struct APIRequest: Sendable {
    var method: HTTPMethod
    var path: String
    var query: [URLQueryItem] = []
    var body: Data?
    /// Mirrors the web client's `retryOnUnauthorized`: auth endpoints disable the
    /// 401 → refresh → replay dance so a bad password isn't "fixed" by a token refresh.
    var retryOnUnauthorized = true
    var accept = "application/json"

    static func get(_ path: String, query: [URLQueryItem] = []) -> APIRequest {
        APIRequest(method: .get, path: path, query: query)
    }

    static func post(_ path: String, retryOnUnauthorized: Bool = true) -> APIRequest {
        APIRequest(method: .post, path: path, retryOnUnauthorized: retryOnUnauthorized)
    }

    static func post<Body: Encodable & Sendable>(
        _ path: String, body: Body, retryOnUnauthorized: Bool = true
    ) throws -> APIRequest {
        APIRequest(method: .post, path: path, body: try encode(body), retryOnUnauthorized: retryOnUnauthorized)
    }

    static func put<Body: Encodable & Sendable>(_ path: String, body: Body) throws -> APIRequest {
        APIRequest(method: .put, path: path, body: try encode(body))
    }

    static func patch<Body: Encodable & Sendable>(_ path: String, body: Body) throws -> APIRequest {
        APIRequest(method: .patch, path: path, body: try encode(body))
    }

    static func delete(_ path: String) -> APIRequest {
        APIRequest(method: .delete, path: path)
    }

    private static func encode<Body: Encodable>(_ body: Body) throws -> Data {
        try JSONCoding.makeEncoder().encode(body)
    }
}
