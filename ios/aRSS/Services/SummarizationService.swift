import Foundation

/// What the feed and detail screens ask for: a summary for an entry, wherever it comes from.
protocol Summarizing: AnyObject {
    func summarize(id: String) async throws -> SummarizeResponse
    /// The in-progress copy, naming whoever is doing the reading.
    var progressLabel: String { get }
}

/// Routes summarization to the account's cloud provider (`POST /entries/:id/summarize`) or, when
/// the per-device preference is on and Apple Intelligence is available, to the on-device model —
/// uploading the result so the web and other devices see the same summary.
@Observable
final class SummarizationService: Summarizing {
    static let onDeviceModelID = "apple-foundation-models"

    private let api: any ARSSAPI
    private let auth: AuthStore
    private let preferences: SummarizationPreferences
    private let engine: any OnDeviceSummarizing

    init(api: any ARSSAPI, auth: AuthStore, preferences: SummarizationPreferences, engine: any OnDeviceSummarizing) {
        self.api = api
        self.auth = auth
        self.preferences = preferences
        self.engine = engine
    }

    var onDeviceAvailability: OnDeviceAvailability { engine.availability }

    var usesOnDevice: Bool { preferences.onDevice && engine.availability == .available }

    var progressLabel: String {
        let reader = usesOnDevice ? "Apple Intelligence" : (auth.activeProvider?.shortLabel ?? "the model")
        return "Summarizing… (\(reader) is reading the article)"
    }

    func summarize(id: String) async throws -> SummarizeResponse {
        guard usesOnDevice else { return try await api.summarize(id: id) }

        let detail = try await api.entryDetail(id: id)
        // Once set, a summary is never re-requested — same rule as the server.
        if let summary = detail.summary {
            return SummarizeResponse(summary: summary, processingState: detail.processingState)
        }
        // Not fetched yet or failed: let the server answer with its usual 409s.
        guard detail.processingState == .fetched else { return try await api.summarize(id: id) }

        let text = detail.articleText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard text.count >= 200 else {
            throw APIError.http(status: 422, code: "article_too_short", message: "Extracted article body is too short to summarize", retryable: false)
        }

        let draft: OnDeviceSummary
        do {
            draft = try await engine.summarize(title: detail.title, byline: detail.byline, articleText: text)
        } catch OnDeviceError.contentRefused {
            // News about violence or crime trips on-device guardrails; the cloud provider is the
            // better answer when there is one.
            if auth.isLlmConfigured { return try await api.summarize(id: id) }
            throw APIError.http(status: 422, code: "on_device_refused", message: "Apple Intelligence couldn't summarize this article.", retryable: false)
        } catch OnDeviceError.transient(let reason) {
            throw APIError.http(status: 503, code: "on_device_failed", message: "Apple Intelligence couldn't finish summarizing this article. \(reason)", retryable: true)
        }

        return try await api.uploadSummary(id: id, ClientSummaryRequest(intro: draft.intro, bullets: draft.bullets, model: Self.onDeviceModelID))
    }
}
