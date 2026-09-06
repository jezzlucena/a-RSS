import Foundation
import Testing
@testable import aRSS

@Suite("DTO decoding")
struct DTODecodingTests {
    private let decoder = JSONCoding.makeDecoder()
    private let encoder = JSONCoding.makeEncoder()

    @Test func decodesAFullFeedPage() throws {
        let page = try decoder.decode(FeedResponse.self, from: Data(Fixtures.feedResponse.utf8))
        #expect(page.entries.count == 2)
        #expect(page.unreadCount == 42)
        #expect(page.nextCursor != nil)

        let full = page.entries[0]
        #expect(full.summary?.bullets.count == 3)
        #expect(full.image?.source == .og)
        #expect(full.processingState == .summarized)
        #expect(full.error == nil)
        #expect(full.canExpand)
        // Fractional-second ISO-8601 with Z.
        #expect(Calendar(identifier: .gregorian).component(.year, from: full.publishedAt) == 2026)

        let minimal = page.entries[1]
        #expect(minimal.categoryId == nil)
        #expect(minimal.summary == nil)
        #expect(minimal.image == nil)
        #expect(minimal.error == "fetch_failed: ladder:timeout")
        // Whole-second ISO-8601 is accepted too.
        #expect(minimal.publishedAt.timeIntervalSince1970 > 0)
    }

    @Test func unknownEnumValuesDecodeToUnknownInsteadOfFailing() throws {
        let entry = try decoder.decode(Entry.self, from: Data(Fixtures.unknownStateEntry.utf8))
        #expect(entry.processingState == .unknown)

        let me = try decoder.decode(MeResponse.self, from: Data(Fixtures.me.utf8))
        #expect(me.authMethods == [.password, .apple, .unknown, .magic])
        #expect(me.displayName == nil)
    }

    @Test func llmSettingsDecodeWithTolerantProvidersAndTheProtocolKey() throws {
        let me = try decoder.decode(MeResponse.self, from: Data(Fixtures.me.utf8))
        #expect(me.llm.provider == .openai)
        #expect(me.llm.providers.map(\.id) == [.anthropic, .openai, .unknown])
        let active = try #require(me.llm.active)
        #expect(active.configured)
        #expect(active.transport == .openaiCompatible)
        #expect(active.model == "gpt-4.1")
        #expect(active.defaultBaseUrl == "https://api.openai.com/v1")
        #expect(me.llm.providers[2].transport == .unknown)
    }

    @Test func llmRequestsEncodeTriStatePatches() throws {
        func json(_ request: UpsertLLMCredentialRequest) throws -> String {
            String(decoding: try encoder.encode(request), as: UTF8.self)
        }
        #expect(try json(UpsertLLMCredentialRequest(apiKey: "sk-12345678")) == "{\"apiKey\":\"sk-12345678\"}")
        #expect(try json(UpsertLLMCredentialRequest(model: .clear)) == "{\"model\":null}")
        let custom = try JSONSerialization.jsonObject(with: try encoder.encode(UpsertLLMCredentialRequest(model: .set("llama3.1:8b"), baseUrl: .set("http://localhost:11434/v1")))) as? [String: Any]
        #expect(custom?["model"] as? String == "llama3.1:8b")
        #expect(custom?["baseUrl"] as? String == "http://localhost:11434/v1")
        #expect(custom?["apiKey"] == nil)

        let upload = try JSONSerialization.jsonObject(with: try encoder.encode(ClientSummaryRequest(intro: "I.", bullets: ["a", "b", "c"], model: "apple-foundation-models"))) as? [String: Any]
        #expect((upload?["bullets"] as? [String])?.count == 3)
        #expect(upload?["model"] as? String == "apple-foundation-models")
        #expect(String(decoding: try encoder.encode(SelectLLMProviderRequest(provider: .kimi)), as: UTF8.self) == "{\"provider\":\"kimi\"}")
    }

    @Test func knownCasesExcludeUnknown() {
        #expect(!BypassStrategy.knownCases.contains(.unknown))
        #expect(BypassStrategy.knownCases.count == 6)
    }

    @Test func categoryColorIsOptionalWhenKeyIsMissing() throws {
        let category = try decoder.decode(Category.self, from: Data(Fixtures.categoryWithoutColor.utf8))
        #expect(category.color == nil)
    }

    @Test func sourceDecodesEnumsAndNullables() throws {
        let source = try decoder.decode(Source.self, from: Data(Fixtures.source.utf8))
        #expect(source.bypassStrategy == .archive_ph)
        #expect(source.siteUrl == nil)
        #expect(source.lastPolledAt != nil)
    }

    @Test func unreadCountsToleratesMissingMaps() throws {
        let counts = try decoder.decode(UnreadCounts.self, from: Data("{\"all\": 3}".utf8))
        #expect(counts.all == 3)
        #expect(counts.categories.isEmpty)
        #expect(counts.sources.isEmpty)
    }

    @Test func entryDetailProjectsToEntry() throws {
        let detail = try decoder.decode(EntryDetail.self, from: Data(Fixtures.entryDetail.utf8))
        #expect(detail.articleText?.contains("Second paragraph") == true)
        #expect(detail.byline == "By Someone")
        let entry = detail.entry
        #expect(entry.id == detail.id)
        #expect(entry.summary == detail.summary)
    }

    @Test func failuresDecode() throws {
        let response = try decoder.decode(FailuresResponse.self, from: Data(Fixtures.failures.utf8))
        #expect(response.items.first?.error == "fetch_failed: googlebot:403")
    }

    @Test func updateSourceRequestEncodesTriStateCategory() throws {
        func json(_ request: UpdateSourceRequest) throws -> String {
            String(decoding: try encoder.encode(request), as: UTF8.self)
        }
        #expect(try json(UpdateSourceRequest(categoryId: .clear)) == "{\"categoryId\":null}")
        #expect(try json(UpdateSourceRequest(categoryId: .set("abc"))) == "{\"categoryId\":\"abc\"}")
        #expect(try json(UpdateSourceRequest(title: "New")) == "{\"title\":\"New\"}")
    }

    @Test func signupOmitsEmptyDisplayName() throws {
        let data = try encoder.encode(SignupRequest(email: "a@b.com", password: "secret123", displayName: nil))
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        #expect(object?["displayName"] == nil)
        #expect(object?["email"] as? String == "a@b.com")
    }

    @Test func feedScopeRoundTrips() {
        #expect(FeedScope.all.queryValue == "all")
        #expect(FeedScope.category("abc").queryValue == "category:abc")
        #expect(FeedScope(queryValue: "source:xyz") == .source("xyz"))
        #expect(FeedScope(queryValue: "bogus") == nil)
    }
}
