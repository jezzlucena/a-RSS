import Foundation
import Testing
@testable import aRSS

@Suite("FeedStore")
struct FeedStoreTests {
    private func makeStore(_ api: FakeARSSAPI) -> (FeedStore, ToastCenter) {
        let auth = AuthStore(api: api)
        let sources = SourcesStore(api: api, auth: auth)
        let toasts = ToastCenter()
        let store = FeedStore(api: api, auth: auth, sources: sources, toasts: toasts, summarizer: Make.summarizer(api: api, auth: auth), sleep: { _ in })
        return (store, toasts)
    }

    @Test func defaultsMatchTheWebAndTheFirstLoadAsksForUnread() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a")], cursor: "c1", unread: 7)]
        let (store, _) = makeStore(api)

        #expect(store.scope == .all)
        #expect(store.order == .desc)
        #expect(store.filter == .unread)

        await store.loadInitial()
        #expect(api.feedCalls == [.init(scope: .all, order: .desc, unreadOnly: true, cursor: nil)])
        #expect(store.entries.map(\.id) == ["a"])
        #expect(store.cursor == "c1")
        #expect(store.unreadCount == 7)
        #expect(store.hasLoaded)
    }

    @Test func loadMoreAppendsAndStopsAtTheLastPage() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a")], cursor: "c1"), Make.page([Make.entry("b")], cursor: nil)]
        let (store, _) = makeStore(api)
        await store.loadInitial()
        await store.loadMore()
        #expect(store.entries.map(\.id) == ["a", "b"])
        #expect(api.feedCalls.last?.cursor == "c1")
        #expect(store.cursor == nil)

        await store.loadMore()
        #expect(api.feedCalls.count == 2)
    }

    @Test func reloadReplacesThePageWithoutBlankingAndFoldsInPending() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a")], unread: 1)]
        let (store, _) = makeStore(api)
        await store.loadInitial()
        api.feedPages = [Make.page([Make.entry("b"), Make.entry("a")], unread: 2)]
        await store.refresh()
        #expect(store.pendingEntries.map(\.id) == ["b"])

        store.expand("a")
        await store.reload()
        #expect(store.entries.map(\.id) == ["b", "a"])
        #expect(store.pendingEntries.isEmpty)
        #expect(store.unreadCount == 2)
        #expect(store.expandedID == nil, "a fresh page has no expanded card")
        #expect(!store.loading, "the refresh control is the only progress indicator")
    }

    @Test func loadFailureIsAnInlineErrorNotAToast() async {
        let api = FakeARSSAPI()
        api.feedPages = [.failure(Make.serverError)]
        let (store, toasts) = makeStore(api)
        await store.loadInitial()
        #expect(store.error == "Boom")
        #expect(toasts.current == nil)
        #expect(!store.loading)
    }

    @Test func refreshMergesInPlacePreservingLocalStateAndParksNewEntries() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a", summary: Make.summary), Make.entry("b")], unread: 2)]
        let (store, _) = makeStore(api)
        await store.loadInitial()
        await store.toggleRead("a") // local truth: read

        api.feedPages = [Make.page([Make.entry("c"), Make.entry("a", read: false, summary: nil), Make.entry("b")], unread: 9)]
        await store.refresh()

        #expect(store.entries.map(\.id) == ["a", "b"], "positions are kept")
        #expect(store.entries[0].isRead, "local read state wins")
        #expect(store.entries[0].summary == Make.summary, "a loaded summary is never dropped")
        #expect(store.pendingEntries.map(\.id) == ["c"])
        #expect(store.unreadCount == 9)

        await store.refresh()
        #expect(store.pendingEntries.map(\.id) == ["c"], "no duplicates across refreshes")

        store.commitPending()
        #expect(store.entries.map(\.id) == ["c", "a", "b"])
        #expect(store.pendingEntries.isEmpty)
        #expect(store.scrollRequest?.target == .top)
    }

    @Test func refreshIsSilentOnFailureAndSkippedBeforeTheFirstLoad() async {
        let api = FakeARSSAPI()
        let (store, toasts) = makeStore(api)
        await store.refresh()
        #expect(api.feedCalls.isEmpty)

        api.feedPages = [Make.page([Make.entry("a")])]
        await store.loadInitial()
        api.feedPages = [.failure(Make.serverError)]
        await store.refresh()
        #expect(store.entries.map(\.id) == ["a"])
        #expect(store.error == nil)
        #expect(toasts.current == nil)
    }

    @Test func toggleReadIsOptimisticAndTracksManualUnread() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a")], unread: 3)]
        let (store, _) = makeStore(api)
        await store.loadInitial()

        await store.toggleRead("a")
        #expect(store.entries[0].isRead)
        #expect(store.unreadCount == 2)
        #expect(!store.manuallyUnreadIDs.contains("a"))

        await store.toggleRead("a")
        #expect(!store.entries[0].isRead)
        #expect(store.unreadCount == 3)
        #expect(store.manuallyUnreadIDs.contains("a"), "marking unread records explicit intent")
        #expect(api.readCalls.map(\.read) == [true, false])
        await settle()
        #expect(api.unreadCountsCalls == 2, "sidebar counts refresh after each success")
    }

    @Test func toggleReadRevertsAndToastsOnFailure() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a")], unread: 3)]
        api.setEntryReadResult = .failure(Make.serverError)
        let (store, toasts) = makeStore(api)
        await store.loadInitial()

        let result = await store.toggleRead("a")
        #expect(result == false)
        #expect(!store.entries[0].isRead)
        #expect(store.unreadCount == 3)
        #expect(toasts.current?.message == "Boom")
    }

    @Test func bulkMarkReadAppliesTheCutoffAndDropsReadRowsInUnreadMode() async {
        let now = Date()
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([
            Make.entry("old", publishedAt: now.addingTimeInterval(-2 * 86_400)),
            Make.entry("new", publishedAt: now),
        ], unread: 10)]
        api.markReadResult = .success(4)
        let (store, _) = makeStore(api)
        await store.loadInitial()

        let marked = await store.markBulkRead(.olderThan1d, now: now)
        #expect(marked == 4)
        #expect(api.markReadCalls.first?.1 == .olderThan1d)
        #expect(store.entries.map(\.id) == ["new"], "read rows leave the unread list")
        #expect(store.unreadCount == 6)
    }

    @Test func bulkMarkReadKeepsRowsInAllMode() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a"), Make.entry("b")], unread: 2)]
        api.markReadResult = .success(2)
        let (store, _) = makeStore(api)
        await store.setFilter(.all)
        #expect(api.feedCalls.last?.unreadOnly == false)
        await store.markBulkRead(.all)
        #expect(store.entries.count == 2)
        #expect(store.entries.allSatisfy { $0.isRead })
    }

    @Test func pollFeedRefreshesSourcesThenReplacesTheList() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a")])]
        let (store, _) = makeStore(api)
        await store.loadInitial()
        api.feedPages = [Make.page([Make.entry("z")], unread: 1)]
        await store.refresh()
        #expect(store.pendingEntries.map(\.id) == ["z"])

        api.feedPages = [Make.page([Make.entry("z"), Make.entry("a")], unread: 1)]
        await store.pollFeed()
        #expect(api.refreshSourcesCalls == [.all])
        #expect(store.entries.map(\.id) == ["z", "a"])
        #expect(store.pendingEntries.isEmpty)
        #expect(!store.polling)
    }

    @Test func pollFeedFailureToasts() async {
        let api = FakeARSSAPI()
        api.refreshSourcesError = Make.serverError
        let (store, toasts) = makeStore(api)
        await store.pollFeed()
        #expect(toasts.current?.message == "Boom")
    }

    @Test func summarizeCachesAndRecordsRetryableFailures() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("done", summary: Make.summary), Make.entry("todo")])]
        api.summarizeResults["todo"] = .failure(.http(status: 503, code: "rate_limited", message: "Slow down", retryable: true))
        let (store, _) = makeStore(api)
        await store.loadInitial()

        await store.summarize("done")
        #expect(api.summarizeCalls.isEmpty, "an existing summary is never re-requested")

        await store.summarize("todo")
        #expect(api.summarizeCalls == ["todo"])
        #expect(store.summaryFailures["todo"] == .init(message: "Slow down", retryable: true, code: "rate_limited"))

        api.summarizeResults["todo"] = .success(SummarizeResponse(summary: Make.summary, processingState: .summarized))
        await store.summarize("todo")
        #expect(store.entries[1].summary == Make.summary)
        #expect(store.entries[1].processingState == .summarized)
        #expect(store.summaryFailures["todo"] == nil)
    }

    @Test func expandSummarizesAndCollapseAutoMarksRead() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a"), Make.entry("b")], unread: 2)]
        api.summarizeResults["a"] = .success(SummarizeResponse(summary: Make.summary, processingState: .summarized))
        let (store, _) = makeStore(api)
        await store.loadInitial()

        store.expand("a")
        #expect(store.expandedID == "a")
        #expect(store.scrollRequest?.target == .entry("a"))
        await settle()
        #expect(api.summarizeCalls == ["a"])

        store.collapse()
        await settle()
        #expect(store.expandedID == nil)
        #expect(api.readCalls.map(\.id) == ["a"])
        #expect(store.entries[0].isRead)
    }

    @Test func markingUnreadWhileExpandedSuppressesAutoMarkRead() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a", read: true)], unread: 0)]
        let (store, _) = makeStore(api)
        await store.loadInitial()

        store.expand("a")
        await store.toggleRead("a") // explicit unread while open
        #expect(store.manuallyUnreadIDs.contains("a"))
        store.collapse()
        await settle()
        #expect(api.readCalls.map(\.read) == [false], "no auto-mark-read after an explicit unread")
        #expect(!store.entries[0].isRead)

        store.expand("a")
        #expect(!store.manuallyUnreadIDs.contains("a"), "re-expanding restores the default")
    }

    @Test func failedEntriesCannotExpandByTapButKeysCanStepOntoThem() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a", state: .failed), Make.entry("b")])]
        let (store, _) = makeStore(api)
        await store.loadInitial()

        store.toggleExpanded("a")
        #expect(store.expandedID == nil)
        store.moveExpansion(by: 1)
        #expect(store.expandedID == "a", "j from nothing selects index 0, like the web")
        store.moveExpansion(by: 1)
        #expect(store.expandedID == "b")
        store.moveExpansion(by: 5)
        #expect(store.expandedID == "b", "clamped to the last entry")
    }

    @Test func changingScopeResetsWithoutSideEffectsAndSelectingItAgainReloads() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a")], unread: 1)]
        let (store, _) = makeStore(api)
        await store.loadInitial()
        store.expand("a")

        store.select(.category("cat"))
        await settle()
        #expect(store.scope == .category("cat"))
        #expect(store.entries.isEmpty)
        #expect(store.expandedID == nil)
        #expect(store.unreadCount == 0)
        #expect(api.readCalls.isEmpty, "a scope change never marks anything read")

        let before = api.feedCalls.count
        store.select(.category("cat"))
        await settle()
        #expect(api.feedCalls.count == before + 1, "re-selecting the active scope reloads it")
        #expect(api.feedCalls.last?.scope == .category("cat"))
    }

    @Test func retryResetsTheEntryToPending() async {
        let api = FakeARSSAPI()
        var failed = Make.entry("a", state: .failed)
        failed.error = "fetch_failed: boom"
        api.feedPages = [Make.page([failed])]
        let (store, _) = makeStore(api)
        await store.loadInitial()
        await store.retryEntry("a")
        #expect(api.retryCalls == ["a"])
        #expect(store.entries[0].processingState == .pending)
        #expect(store.entries[0].error == nil)
    }

    @Test func fallbackBodyIsFetchedOnceAndFailuresStoreEmpty() async {
        let api = FakeARSSAPI()
        api.feedPages = [Make.page([Make.entry("a"), Make.entry("b")])]
        let (store, _) = makeStore(api)
        await store.loadInitial()

        await store.loadFallbackBody("a")
        #expect(store.fallbackBodies["a"] == "")
        await store.loadFallbackBody("a")
        #expect(api.detailCalls == ["a"], "never retried in a loop")
    }
}
