import Foundation
import Observation

/// CarPlay's library is separate from the on-screen feed, so paging never moves phone cards.
/// A queue item always speaks a summary; fetching an article body is never a speech fallback.
@Observable
final class ListeningQueue {
    private(set) var entries: [Entry] = []
    private(set) var nextCursor: String?
    private(set) var loading = false
    private(set) var error: String?
    private let api: any ARSSAPI
    private let auth: AuthStore
    private let summarizer: any Summarizing
    private let speech: any SpeechPlaying
    private var revision = UUID()

    init(api: any ARSSAPI, auth: AuthStore, summarizer: any Summarizing, speech: any SpeechPlaying) {
        self.api = api; self.auth = auth; self.summarizer = summarizer; self.speech = speech
    }

    func reset() {
        revision = UUID()
        entries = []; nextCursor = nil; error = nil; loading = false
    }

    func load(more: Bool = false) async {
        guard !loading, !more || nextCursor != nil else { return }
        loading = true; error = nil
        let token = revision
        defer { if token == revision { loading = false } }
        await auth.hydrate()
        guard token == revision, !Task.isCancelled else { return }
        guard auth.status == .authenticated else { error = "Sign in on your iPhone"; return }
        do {
            let page = try await api.fetchFeed(scope: .all, order: .desc, unreadOnly: false, cursor: more ? nextCursor : nil)
            guard token == revision, !Task.isCancelled else { return }
            let ready = page.entries.filter { $0.summary != nil || $0.processingState == .fetched }
            if more {
                let ids = Set(entries.map(\.id))
                entries.append(contentsOf: ready.filter { !ids.contains($0.id) })
            } else { entries = ready }
            nextCursor = page.nextCursor
        } catch {
            guard token == revision, !Task.isCancelled else { return }
            auth.noteError(error)
            self.error = auth.status == .authenticated ? "Could not load articles. Try Refresh." : "Sign in on your iPhone"
        }
    }

    func play(id: String) {
        guard auth.status == .authenticated, let index = entries.firstIndex(where: { $0.id == id }) else { return }
        let entry = entries[index]
        let token = revision
        // Snapshot the loaded queue so a library refresh cannot reorder an active listening session.
        play(entry: entry, queue: entries, index: index, token: token)
    }

    private func play(entry: Entry, queue: [Entry], index: Int, token: UUID) {
        guard token == revision, auth.status == .authenticated else { return }
        let advance: (() -> Void)? = index + 1 < queue.count ? { [weak self] in
            self?.play(entry: queue[index + 1], queue: queue, index: index + 1, token: token)
        } : nil
        let previous: (() -> Void)? = index > 0 ? { [weak self] in
            self?.play(entry: queue[index - 1], queue: queue, index: index - 1, token: token)
        } : nil
        speech.play(id: "carplay:" + entry.id, title: entry.title, text: { [weak self] in
            guard let self, token == self.revision else { throw CancellationError() }
            let summary: EntrySummary
            if let existing = self.entries.first(where: { $0.id == entry.id })?.summary ?? entry.summary {
                summary = existing
            } else {
                summary = try await self.summarizer.summarize(id: entry.id).summary
            }
            try Task.checkCancellation()
            guard token == self.revision else { throw CancellationError() }
            if let current = self.entries.firstIndex(where: { $0.id == entry.id }) {
                self.entries[current].summary = summary
            }
            return ReadAloudScript.summary(title: entry.title, intro: summary.intro, bullets: summary.bullets)
        }, onFinish: advance, next: advance, previous: previous)
    }
}
