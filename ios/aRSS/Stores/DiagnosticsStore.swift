import Foundation
import Observation

@Observable
@MainActor
final class DiagnosticsStore {
    var failures: [FailedEntrySummary] = []
    var loading = false
    var lastError: String?

    private let api: APIClient = .shared

    func load() async {
        loading = true
        defer { loading = false }
        lastError = nil
        do {
            let response: FailuresResponse = try await api.get("/entries/failures")
            failures = response.items
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    @discardableResult
    func retry(id: String) async -> Bool {
        do {
            try await api.postEmpty("/entries/\(id)/retry")
            failures.removeAll { $0.id == id }
            return true
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return false
        }
    }
}
