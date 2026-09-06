import FoundationModels
import Foundation

enum OnDeviceAvailability: Equatable {
    case available
    /// A user-facing reason.
    case unavailable(String)
}

enum OnDeviceError: Error {
    /// The model declined the content (guardrails, unsupported language, refusal). Not worth retrying.
    case contentRefused(String)
    case transient(String)
}

struct OnDeviceSummary: Equatable {
    var intro: String
    var bullets: [String]
}

/// The engine behind on-device summarization; faked in unit tests (FoundationModels never runs there).
protocol OnDeviceSummarizing: AnyObject {
    var availability: OnDeviceAvailability { get }
    func summarize(title: String, byline: String?, articleText: String) async throws -> OnDeviceSummary
}

/// The shape the on-device model fills in. `.count(3)` plus the explicit check below protects
/// the server's three-bullet contract.
@Generable
nonisolated struct SummaryDraft {
    @Guide(description: "One introductory sentence of at most 35 words that gives the core news and its context.")
    var intro: String
    @Guide(description: "Exactly three concise bullets. Each is one complete plain sentence of 14 to 24 words, with no markdown, numbering or leading symbols.", .count(3))
    var bullets: [String]
}

/// Apple Foundation Models. The on-device model has a small context window, so it gets a
/// condensed version of the server prompt and a capped article, and a fresh session per call
/// so transcripts never accumulate.
final class FoundationModelsSummarizer: OnDeviceSummarizing {
    private static let maxCharacters = 6_000
    private static let instructions = """
    You summarize one news article as a short introductory sentence followed by exactly three concise bullets \
    that a busy reader can scan in seconds. Write in a neutral, factual voice: no opinions, no hype, no filler. \
    Do not copy the headline. The intro sets the scene in one sentence. Bullet one states what happened, \
    bullet two gives the key detail or number, bullet three gives why it matters or what comes next. \
    Every bullet is a complete plain sentence with no markdown, dashes, numbering or bullet symbols.
    """

    // Permissive transformations: summarizing news about crime or conflict is a transformation of
    // provided text, which the default guardrails otherwise refuse too eagerly.
    private let model = SystemLanguageModel(guardrails: .permissiveContentTransformations)

    var availability: OnDeviceAvailability {
        switch model.availability {
        case .available:
            return .available
        case .unavailable(let reason):
            switch reason {
            case .deviceNotEligible: return .unavailable("This device doesn't support Apple Intelligence.")
            case .appleIntelligenceNotEnabled: return .unavailable("Turn on Apple Intelligence in Settings to summarize on this device.")
            case .modelNotReady: return .unavailable("The on-device model is still downloading. Try again later.")
            @unknown default: return .unavailable("Apple Intelligence isn't available right now.")
            }
        }
    }

    func summarize(title: String, byline: String?, articleText: String) async throws -> OnDeviceSummary {
        do {
            return try await respond(title: title, byline: byline, body: String(articleText.prefix(Self.maxCharacters)))
        } catch let error as LanguageModelSession.GenerationError {
            switch error {
            case .exceededContextWindowSize:
                return try await respond(title: title, byline: byline, body: String(articleText.prefix(Self.maxCharacters / 2)))
            case .guardrailViolation, .unsupportedLanguageOrLocale, .refusal:
                throw OnDeviceError.contentRefused(error.localizedDescription)
            default:
                throw OnDeviceError.transient(error.localizedDescription)
            }
        } catch let error as OnDeviceError {
            throw error
        } catch {
            throw OnDeviceError.transient(error.localizedDescription)
        }
    }

    private func respond(title: String, byline: String?, body: String) async throws -> OnDeviceSummary {
        let session = LanguageModelSession(model: model, instructions: Self.instructions)
        var prompt = "Title: \(title)\n"
        if let byline, !byline.isEmpty { prompt += "Byline: \(byline)\n" }
        prompt += "\nBody:\n\(body)"
        let response = try await session.respond(to: prompt, generating: SummaryDraft.self)
        let draft = response.content
        guard draft.bullets.count == 3 else {
            throw OnDeviceError.transient("The model returned \(draft.bullets.count) bullets instead of 3.")
        }
        return OnDeviceSummary(intro: draft.intro, bullets: draft.bullets)
    }
}
