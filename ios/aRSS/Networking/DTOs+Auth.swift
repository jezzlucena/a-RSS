// Mirrors packages/shared/src/auth.ts — keep field names and optionality identical.
import Foundation

nonisolated enum AuthMethod: String, TolerantEnum {
    case password, magic, google, apple, unknown
    init(from decoder: any Decoder) throws { self = try Self.decodeTolerant(from: decoder) }
}

nonisolated struct MeResponse: Codable, Sendable, Hashable {
    var id: String
    var email: String
    var displayName: String?
    var authMethods: [AuthMethod]
    /** The account's summarization provider and per-provider configuration state. */
    var llm: LLMSettings
}

// MARK: - LLM providers (packages/shared/src/llm.ts)

nonisolated enum LLMProviderID: String, TolerantEnum {
    case anthropic, openai, gemini, deepseek, qwen, kimi, custom, unknown
    init(from decoder: any Decoder) throws { self = try Self.decodeTolerant(from: decoder) }
}

nonisolated enum LLMProtocol: String, TolerantEnum {
    case anthropic
    case openaiCompatible = "openai-compatible"
    case unknown
    init(from decoder: any Decoder) throws { self = try Self.decodeTolerant(from: decoder) }
}

/// One provider as the API describes it for this user: catalog facts plus configuration state.
/// Defaults, labels and console links come from the server so this client never hardcodes them.
nonisolated struct LLMProviderState: Codable, Sendable, Hashable, Identifiable {
    var id: LLMProviderID
    var label: String
    var shortLabel: String
    /// Wire key is `protocol`, a Swift keyword.
    var transport: LLMProtocol
    var configured: Bool
    var model: String?
    var defaultModel: String?
    var baseUrl: String?
    var defaultBaseUrl: String?
    var keyPlaceholder: String?
    var consoleUrl: String?
    var requiresKey: Bool

    enum CodingKeys: String, CodingKey {
        case id, label, shortLabel, configured, model, defaultModel, baseUrl, defaultBaseUrl, keyPlaceholder, consoleUrl, requiresKey
        case transport = "protocol"
    }
}

nonisolated struct LLMSettings: Codable, Sendable, Hashable {
    var provider: LLMProviderID
    var providers: [LLMProviderState]

    var active: LLMProviderState? { providers.first { $0.id == provider } }
}

nonisolated struct SelectLLMProviderRequest: Encodable, Sendable {
    var provider: LLMProviderID
}

/// Partial upsert: nil leaves a field alone, `.clear` sends null to reset an override.
nonisolated struct UpsertLLMCredentialRequest: Encodable, Sendable {
    var apiKey: String?
    var model: Patch<String>?
    var baseUrl: Patch<String>?

    private enum CodingKeys: String, CodingKey { case apiKey, model, baseUrl }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(apiKey, forKey: .apiKey)
        try Self.encode(model, forKey: .model, into: &container)
        try Self.encode(baseUrl, forKey: .baseUrl, into: &container)
    }

    private static func encode(_ patch: Patch<String>?, forKey key: CodingKeys, into container: inout KeyedEncodingContainer<CodingKeys>) throws {
        switch patch {
        case .set(let value): try container.encode(value, forKey: key)
        case .clear: try container.encodeNil(forKey: key)
        case nil: break
        }
    }
}

nonisolated struct AuthTokensResponse: Codable, Sendable, Hashable {
    var accessToken: String
    /// Seconds until the access token expires. Unused (refresh is reactive), kept for parity.
    var expiresIn: Int
}

nonisolated struct SignupRequest: Encodable, Sendable {
    var email: String
    var password: String
    /// Omitted from the JSON when nil (the web sends `undefined` for an empty name).
    var displayName: String?
}

nonisolated struct LoginRequest: Encodable, Sendable {
    var email: String
    var password: String
}

nonisolated struct MagicRequest: Encodable, Sendable {
    var email: String
}

nonisolated struct MagicConsumeRequest: Encodable, Sendable {
    var token: String
}

nonisolated struct GoogleAuthRequest: Encodable, Sendable {
    var idToken: String
}

nonisolated struct AppleFullName: Encodable, Sendable, Hashable {
    var givenName: String?
    var familyName: String?
}

nonisolated struct AppleAuthRequest: Encodable, Sendable {
    var identityToken: String
    var email: String?
    var fullName: AppleFullName?
}

nonisolated struct ChangePasswordRequest: Encodable, Sendable {
    var newPassword: String
    /// Only sent when the account already has a password (web: included only if truthy).
    var currentPassword: String?
}

