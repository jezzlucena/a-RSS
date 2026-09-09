import Foundation
import Observation

/// Composition root: one API client, one of each store. Stores are injected individually with
/// `.environment(_:)` so views declare exactly what they read.
@Observable
final class AppEnvironment {
    let api: any ARSSAPI
    let auth: AuthStore
    let theme: ThemeStore
    let toasts: ToastCenter
    let sources: SourcesStore
    let feed: FeedStore
    let summarizationPreferences: SummarizationPreferences
    let summarizer: SummarizationService
    let navigation = AppNavigation()
    let speech: SpeechReader
    let listening: ListeningQueue
    static let shared = AppEnvironment.live()
    let layoutMetrics = LayoutMetrics()

    init(api: any ARSSAPI, onDeviceEngine: any OnDeviceSummarizing) {
        self.api = api
        theme = ThemeStore()
        toasts = ToastCenter()
        auth = AuthStore(api: api)
        speech = SpeechReader(api: api, auth: auth, toasts: toasts)
        sources = SourcesStore(api: api, auth: auth)
        summarizationPreferences = SummarizationPreferences()
        summarizer = SummarizationService(api: api, auth: auth, preferences: summarizationPreferences, engine: onDeviceEngine)
        listening = ListeningQueue(api: api, auth: auth, summarizer: summarizer, speech: speech)
        auth.onSessionEnded = { [weak speech, weak listening] in speech?.stop(); listening?.reset() }
        feed = FeedStore(api: api, auth: auth, sources: sources, toasts: toasts, summarizer: summarizer)
    }

    static func live() -> AppEnvironment {
        AppEnvironment(
            api: LiveARSSAPI(client: APIClient(baseURL: AppConfig.apiBaseURL)),
            onDeviceEngine: FoundationModelsSummarizer()
        )
    }
}
