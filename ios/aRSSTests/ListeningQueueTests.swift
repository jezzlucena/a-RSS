import Foundation
import Testing
@testable import aRSS

@Suite("CarPlay summary queue")
struct ListeningQueueTests {
    private func setup(_ api: FakeARSSAPI) async -> (ListeningQueue, RecordingSpeech, QueueSummarizer, AuthStore) {
        api.restoreSessionResult = true
        let auth = AuthStore(api: api)
        await auth.hydrate()
        let speech = RecordingSpeech()
        let summarizer = QueueSummarizer()
        return (ListeningQueue(api: api, auth: auth, summarizer: summarizer, speech: speech), speech, summarizer, auth)
    }

    @Test func loadsReadyArticlesAndPagesWithoutDuplicates() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a"), Make.entry("pending", state: .pending), Make.entry("failed", state: .failed)], cursor: "page2"), Make.page([Make.entry("a"), Make.entry("b", summary: Make.summary)])]
        let (queue, _, _, _) = await setup(api)
        await queue.load()
        #expect(queue.entries.map(\.id) == ["a"])
        await queue.load(more: true)
        #expect(queue.entries.map(\.id) == ["a", "b"])
        #expect(api.feedCalls.last?.cursor == "page2")
    }

    @Test func readsOnlyTitleAndSummaryAndAdvancesThroughTheQueue() async throws {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a", summary: Make.summary), Make.entry("b")])]
        let (queue, speech, summarizer, _) = await setup(api)
        await queue.load()
        queue.play(id: "a")
        #expect(speech.title == "Entry a")
        #expect(try await speech.text?() == "Entry a.\nIntro.\na.\nb.\nc.")
        #expect(summarizer.calls.isEmpty)
        #expect(speech.previous == nil)
        speech.onFinish?()
        #expect(speech.speakingID == "carplay:b")
        #expect(try await speech.text?() == "Entry b.\nIntro.\na.\nb.\nc.")
        #expect(summarizer.calls == ["b"])
        #expect(speech.next == nil)
        #expect(api.detailCalls.isEmpty)
        speech.previous?()
        #expect(speech.speakingID == "carplay:a")
    }

    @Test func summaryFailureNeverFallsBackToFullArticle() async throws {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a")])]
        let (queue, speech, summarizer, _) = await setup(api)
        summarizer.error = Make.serverError
        await queue.load()
        queue.play(id: "a")
        await #expect(throws: Make.serverError) { try await speech.text?() }
        #expect(api.detailCalls.isEmpty)
        #expect(queue.entries.first?.summary == nil)
    }

    @Test func logoutAndResetInvalidateAnOldQueueCompletion() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a"), Make.entry("b")])]
        let (queue, speech, _, auth) = await setup(api)
        await queue.load()
        queue.play(id: "a")
        let completion = speech.onFinish
        queue.reset()
        await auth.logout()
        completion?()
        #expect(speech.playCount == 1)
        #expect(queue.entries.isEmpty)
    }

    @Test func anonymousLaunchDoesNotLoadPrivateArticles() async {
        let api = FakeARSSAPI()
        let auth = AuthStore(api: api)
        let queue = ListeningQueue(api: api, auth: auth, summarizer: QueueSummarizer(), speech: RecordingSpeech())
        await queue.load()
        #expect(api.feedCalls.isEmpty)
        #expect(queue.error == "Sign in on your iPhone")
    }
}

private final class RecordingSpeech: SpeechPlaying {
    var speakingID: String?
    var title = ""
    var text: (() async throws -> String)?
    var onFinish: (() -> Void)?
    var next: (() -> Void)?
    var previous: (() -> Void)?
    var playCount = 0
    func play(id: String, title: String, text: @escaping () async throws -> String, onFinish: (() -> Void)?, next: (() -> Void)?, previous: (() -> Void)?) {
        speakingID = id; self.title = title; self.text = text
        self.onFinish = onFinish; self.next = next; self.previous = previous
        playCount += 1
    }
    func stop() { speakingID = nil }
}

private final class QueueSummarizer: Summarizing {
    var calls: [String] = []
    var error: APIError?
    var progressLabel: String { "Summarizing" }
    func summarize(id: String) async throws -> SummarizeResponse {
        calls.append(id)
        if let error { throw error }
        return SummarizeResponse(summary: Make.summary, processingState: .summarized)
    }
}
