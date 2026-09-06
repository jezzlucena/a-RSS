import Foundation
import Testing
@testable import aRSS

@Suite("SourcesStore")
struct SourcesStoreTests {
    private func makeStore(_ api: FakeARSSAPI) -> SourcesStore {
        SourcesStore(api: api, auth: AuthStore(api: api))
    }

    @Test func loadSortsAndToleratesACountsFailure() async {
        let api = FakeARSSAPI()
        api.categoriesResult = .success([aRSS.Category(id: "c2", name: "Zed", color: nil), aRSS.Category(id: "c1", name: "Alpha", color: "#C9412B")])
        api.sourcesResult = .success([Make.source("s2", title: "Verge"), Make.source("s1", title: "Ars")])
        api.unreadCountsResult = .failure(Make.serverError)
        let store = makeStore(api)
        await store.load()
        #expect(store.categories.map(\.name) == ["Alpha", "Zed"])
        #expect(store.sources.map(\.title) == ["Ars", "Verge"])
        #expect(store.unreadCounts == .empty)
        #expect(store.hasLoaded)
        #expect(store.error == nil)
    }

    @Test func loadFailureIsReported() async {
        let api = FakeARSSAPI()
        api.sourcesResult = .failure(Make.serverError)
        let store = makeStore(api)
        await store.load()
        #expect(store.error == "Boom")
        #expect(!store.hasLoaded)
    }

    @Test func mutationsKeepListsSorted() async throws {
        let api = FakeARSSAPI()
        api.categoriesResult = .success([aRSS.Category(id: "c1", name: "Middle", color: nil)])
        let store = makeStore(api)
        await store.load()
        _ = try await store.createCategory(name: "Aardvark", color: "#000000")
        _ = try await store.createCategory(name: "Zebra", color: nil)
        #expect(store.categories.map(\.name) == ["Aardvark", "Middle", "Zebra"])

        try await store.updateCategory(id: "c1", UpdateCategoryRequest(name: "Zz"))
        #expect(store.categories.map(\.name) == ["Aardvark", "Zebra", "Zz"])
    }

    @Test func deletingACategoryDetachesItsSourcesLocally() async throws {
        let api = FakeARSSAPI()
        api.categoriesResult = .success([aRSS.Category(id: "c1", name: "Tech", color: nil)])
        api.sourcesResult = .success([Make.source("s1", title: "A", categoryId: "c1"), Make.source("s2", title: "B", categoryId: "other")])
        let store = makeStore(api)
        await store.load()
        try await store.deleteCategory(id: "c1")
        #expect(store.categories.isEmpty)
        #expect(store.sources.map(\.categoryId) == [nil, "other"])
        #expect(store.sourceCount(categoryId: "c1") == 0)
    }

    @Test func titleLookupsUseTheWebFallbacks() async {
        let api = FakeARSSAPI()
        api.categoriesResult = .success([aRSS.Category(id: "c1", name: "Tech", color: nil)])
        api.sourcesResult = .success([Make.source("s1", title: "Ars")])
        let store = makeStore(api)
        await store.load()
        #expect(store.title(for: .all) == "All Sources")
        #expect(store.title(for: .category("c1")) == "Tech")
        #expect(store.title(for: .category("missing")) == "Category")
        #expect(store.title(for: .source("s1")) == "Ars")
        #expect(store.title(for: .source("missing")) == "Source")
    }
}
