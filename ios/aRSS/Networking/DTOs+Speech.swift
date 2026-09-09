// Mirrors packages/shared/src/speech.ts.
import Foundation

nonisolated enum SpeechProvider: String, TolerantEnum {
    case system, elevenlabs, unknown
    init(from decoder: any Decoder) throws { self = try Self.decodeTolerant(from: decoder) }
}

nonisolated struct SpeechSettings: Codable, Sendable, Hashable {
    var provider: SpeechProvider
    var configured: Bool
    var voiceId: String
    var modelId: String

    static let defaults = SpeechSettings(provider: .system, configured: false,
                                         voiceId: "JBFqnCBsd6RMkjVDRZzb", modelId: "eleven_multilingual_v2")
}

nonisolated struct UpdateSpeechSettingsRequest: Encodable, Sendable {
    var provider: SpeechProvider?
    var apiKey: String?
    var voiceId: String?
    var modelId: String?
}

nonisolated struct CreateSpeechRequest: Encodable, Sendable {
    var text: String
}
