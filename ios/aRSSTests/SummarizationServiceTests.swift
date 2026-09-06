import Foundation
import Testing
@testable import aRSS

@Suite("SummarizationService")
struct SummarizationServiceTests {
    private struct Harness {
        let api: FakeARSSAPI
        let auth: AuthStore
        let preferences: SummarizationPreferences
        let engine: FakeOnDeviceEngine
        let service: SummarizationService
    }

    private func makeHarness(onDevice: Bool, available: Bool = true, cloudConfigured: Bool = false) async -> Harness {
        let api = FakeARSSAPI()
        api.restoreSessionResult = true
        api.meResult = .success(MeResponse(id: "u1", email: "a@b.com", displayName: nil, authMethods: [.magic], llm: Make.llmSettings(active: .openai, configured: cloudConfigured)))
        let auth = AuthStore(api: api)
        await auth.hydrate()
        let preferences = SummarizationPreferences(defaults: Make.isolatedDefaults())
        preferences.onDevice = onDevice
        let engine = FakeOnDeviceEngine()
        engine.availability = available ? .available : .unavailable("No Apple Intelligence here.")
        let service = SummarizationService(api: api, auth: auth, preferences: preferences, engine: engine)
        api.summarizeResults["e1"] = .success(SummarizeResponse(summary: Make.summary, processingState: .summarized))
        return Harness(api: api, auth: auth, preferences: preferences, engine: engine, service: service)
    }

    @Test func preferenceOffUsesTheCloudOnly() async throws {
        let h = await makeHarness(onDevice: false)
        let response = try await h.service.summarize(id: "e1")
        #expect(response.summary == Make.summary)
        #expect(h.api.summarizeCalls == ["e1"])
        #expect(h.api.detailCalls.isEmpty)
        #expect(h.engine.calls.isEmpty)
        #expect(h.service.progressLabel == "Summarizing… (Openai is reading the article)")
    }

    @Test func unavailableModelFallsBackToTheCloudEvenWhenPreferred() async throws {
        let h = await makeHarness(onDevice: true, available: false)
        _ = try await h.service.summarize(id: "e1")
        #expect(h.api.summarizeCalls == ["e1"])
        #expect(!h.service.usesOnDevice)
    }

    @Test func onDeviceSummarizesAndUploads() async throws {
        let h = await makeHarness(onDevice: true)
        h.api.detailResults["e1"] = .success(Make.detail("e1"))
        let response = try await h.service.summarize(id: "e1")
        #expect(h.api.detailCalls == ["e1"])
        #expect(h.engine.calls.count == 1)
        #expect(h.engine.calls.first?.title == "Entry e1")
        #expect(h.api.summarizeCalls.isEmpty, "the cloud is never asked")
        let upload = try #require(h.api.uploadSummaryCalls.first)
        #expect(upload.id == "e1")
        #expect(upload.request.model == "apple-foundation-models")
        #expect(upload.request.bullets == ["one", "two", "three"])
        #expect(response.summary.intro == "On-device intro.")
        #expect(response.processingState == .summarized)
        #expect(h.service.progressLabel == "Summarizing… (Apple Intelligence is reading the article)")
    }

    @Test func existingSummaryIsReturnedWithoutRunningTheModel() async throws {
        let h = await makeHarness(onDevice: true)
        h.api.detailResults["e1"] = .success(Make.detail("e1", state: .summarized, summary: Make.summary))
        let response = try await h.service.summarize(id: "e1")
        #expect(response.summary == Make.summary)
        #expect(h.engine.calls.isEmpty)
        #expect(h.api.uploadSummaryCalls.isEmpty)
    }

    @Test func unfetchedEntriesDeferToTheServer() async throws {
        let h = await makeHarness(onDevice: true)
        h.api.detailResults["e1"] = .success(Make.detail("e1", state: .pending, articleText: nil))
        _ = try await h.service.summarize(id: "e1")
        #expect(h.api.summarizeCalls == ["e1"])
        #expect(h.engine.calls.isEmpty)
    }

    @Test func shortArticlesFailLikeTheServerDoes() async throws {
        let h = await makeHarness(onDevice: true)
        h.api.detailResults["e1"] = .success(Make.detail("e1", articleText: "too short"))
        await #expect(throws: APIError.http(status: 422, code: "article_too_short", message: "Extracted article body is too short to summarize", retryable: false)) {
            _ = try await h.service.summarize(id: "e1")
        }
        #expect(h.api.uploadSummaryCalls.isEmpty)
    }

    @Test func refusalFallsBackToTheCloudWhenConfigured() async throws {
        let h = await makeHarness(onDevice: true, cloudConfigured: true)
        h.api.detailResults["e1"] = .success(Make.detail("e1"))
        h.engine.result = .failure(.contentRefused("guardrail"))
        let response = try await h.service.summarize(id: "e1")
        #expect(response.summary == Make.summary)
        #expect(h.api.summarizeCalls == ["e1"])
        #expect(h.api.uploadSummaryCalls.isEmpty)
    }

    @Test func refusalWithoutACloudProviderIsANonRetryableError() async throws {
        let h = await makeHarness(onDevice: true, cloudConfigured: false)
        h.api.detailResults["e1"] = .success(Make.detail("e1"))
        h.engine.result = .failure(.contentRefused("guardrail"))
        do {
            _ = try await h.service.summarize(id: "e1")
            Issue.record("expected an error")
        } catch let error as APIError {
            #expect(error.code == "on_device_refused")
            #expect(!error.retryable)
        }
        #expect(h.api.summarizeCalls.isEmpty)
    }

    @Test func transientEngineFailuresAreRetryable() async throws {
        let h = await makeHarness(onDevice: true)
        h.api.detailResults["e1"] = .success(Make.detail("e1"))
        h.engine.result = .failure(.transient("busy"))
        do {
            _ = try await h.service.summarize(id: "e1")
            Issue.record("expected an error")
        } catch let error as APIError {
            #expect(error.code == "on_device_failed")
            #expect(error.retryable)
        }
    }
}
