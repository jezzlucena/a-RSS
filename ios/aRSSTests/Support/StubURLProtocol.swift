import Foundation
import Synchronization

/// In-process HTTP stub for `APIClient` tests. Installed per-session through
/// `URLSessionConfiguration.protocolClasses`, so nothing global is touched — but the router
/// and recorded requests are static, so suites using it must be `.serialized`.
nonisolated final class StubURLProtocol: URLProtocol {
    struct Recorded: Sendable {
        let method: String
        let url: URL
        let headers: [String: String]
        let body: Data?

        var path: String { url.path }
        var queryItems: [URLQueryItem] { URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? [] }
        var authorization: String? { headers["Authorization"] }
        var jsonBody: [String: Any]? {
            body.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        }
    }

    struct Response: Sendable {
        var status: Int
        var body: Data
        var headers: [String: String]

        init(status: Int, json: String, headers: [String: String] = ["Content-Type": "application/json"]) {
            self.status = status
            self.body = Data(json.utf8)
            self.headers = headers
        }

        init(status: Int, text: String) {
            self.status = status
            self.body = Data(text.utf8)
            self.headers = ["Content-Type": "text/html; charset=utf-8"]
        }

        static let noContent = Response(status: 204, json: "")
    }

    typealias Router = @Sendable (Recorded) -> Response

    private struct State: Sendable {
        var router: Router?
        var recorded: [Recorded] = []
    }

    private static let state = Mutex(State())

    static func install(_ router: @escaping Router) {
        state.withLock { $0 = State(router: router) }
    }

    static func reset() {
        state.withLock { $0 = State() }
    }

    static var recorded: [Recorded] {
        state.withLock { $0.recorded }
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let recorded = Recorded(
            method: request.httpMethod ?? "GET",
            url: url,
            headers: request.allHTTPHeaderFields ?? [:],
            body: Self.readBody(request)
        )
        let response = Self.state.withLock { state -> Response in
            state.recorded.append(recorded)
            return state.router?(recorded) ?? Response(status: 500, text: "no router installed")
        }
        let http = HTTPURLResponse(url: url, statusCode: response.status, httpVersion: "HTTP/1.1", headerFields: response.headers)!
        client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
        if !response.body.isEmpty { client?.urlProtocol(self, didLoad: response.body) }
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    // URLSession hands uploads to protocols as a stream, not `httpBody`.
    private static func readBody(_ request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let size = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: size)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: size)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}
