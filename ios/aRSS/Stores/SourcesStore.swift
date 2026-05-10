import Foundation
import Observation

@Observable
@MainActor
final class SourcesStore {
    var sources: [Source] = []
    var categories: [Category] = []
    var loading = false
    var lastError: String?

    private let api: APIClient = .shared

    func load() async {
        loading = true
        defer { loading = false }
        do {
            async let cats: [Category] = api.get("/categories")
            async let srcs: [Source] = api.get("/sources")
            self.categories = try await cats
            self.sources = try await srcs
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
