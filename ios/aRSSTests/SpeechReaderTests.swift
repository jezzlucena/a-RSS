import Foundation
import Testing
@testable import aRSS

@Suite("Speech preparation cancellation", .serialized)
struct SpeechReaderTests {
    @Test func latePreparationCannotReplaceANewerReadOrAdvanceAStoppedQueue() async throws {
        let api = FakeARSSAPI()
        let auth = AuthStore(api: api)
        let reader = SpeechReader(api: api, auth: auth, toasts: ToastCenter())
        let first = ScriptGate()
        let second = ScriptGate()
        var completions = 0
        reader.play(id: "first", title: "First", text: { await first.text() }, onFinish: { completions += 1 })
        for _ in 0..<20 where first.continuation == nil { await Task.yield() }
        let firstCompletion = try #require(first.continuation)
        reader.play(id: "second", title: "Second", text: { await second.text() }, onFinish: { completions += 1 })
        for _ in 0..<20 where second.continuation == nil { await Task.yield() }
        let secondCompletion = try #require(second.continuation)
        firstCompletion.resume(returning: "Old text")
        for _ in 0..<5 { await Task.yield() }
        #expect(reader.speakingID == "second")
        #expect(reader.isLoading)
        reader.stop()
        secondCompletion.resume(returning: "New text")
        for _ in 0..<5 { await Task.yield() }
        #expect(reader.speakingID == nil)
        #expect(!reader.isLoading)
        #expect(completions == 0)
        #expect(api.speechTexts.isEmpty)
    }
}

private final class ScriptGate {
    var continuation: CheckedContinuation<String, Never>?
    func text() async -> String {
        await withCheckedContinuation { continuation = $0 }
    }
}
