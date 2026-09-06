import Foundation

/// Every failure surfaced by the networking layer. `.http` carries the server's
/// `{ error, message, retryable }` envelope (see packages/shared/src/errors.ts): `message`
/// is safe to show verbatim and `retryable` is the only signal to gate a "Try again" on.
nonisolated enum APIError: Error, Sendable, Equatable {
    case http(status: Int, code: String, message: String, retryable: Bool)
    case transport(String)
    case decoding(String)
    /// A 401 that survived a refresh attempt (or where refresh wasn't allowed to run).
    /// The session is gone; stores hand this to `AuthStore.handleUnauthenticated()`.
    case unauthenticated

    var status: Int? {
        if case .http(let status, _, _, _) = self { return status }
        return nil
    }

    var code: String? {
        if case .http(_, let code, _, _) = self { return code }
        return nil
    }

    var retryable: Bool {
        switch self {
        case .http(_, _, _, let retryable): retryable
        case .transport: true
        case .decoding, .unauthenticated: false
        }
    }
}

nonisolated extension APIError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .http(_, _, let message, _): message
        case .transport(let detail): "Could not reach the server. \(detail)"
        case .decoding(let detail): "The server sent something unexpected. \(detail)"
        case .unauthenticated: "Your session has expired. Sign in again."
        }
    }
}

nonisolated extension Error {
    /// The message the web client would show: the server's `message`, else the error's own.
    func userMessage(fallback: String) -> String {
        if let api = self as? APIError { return api.errorDescription ?? fallback }
        let description = localizedDescription
        return description.isEmpty ? fallback : description
    }

    var isRetryable: Bool { (self as? APIError)?.retryable ?? true }
}
