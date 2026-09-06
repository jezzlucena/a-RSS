import Foundation

/// String enums mirrored from the API decode unknown values to `.unknown` instead of
/// failing the whole payload, so a new server-side enum case never breaks an old client.
/// Conformers must still declare `init(from:)` as `self = Self.decodeTolerant(from: decoder)`
/// — a protocol-extension witness would be ambiguous with the standard library's
/// RawRepresentable decoding.
nonisolated protocol TolerantEnum: RawRepresentable, Codable, Sendable, Hashable, CaseIterable
where RawValue == String {
    static var unknown: Self { get }
}

nonisolated extension TolerantEnum {
    static func decodeTolerant(from decoder: any Decoder) throws -> Self {
        let raw = try decoder.singleValueContainer().decode(String.self)
        return Self(rawValue: raw) ?? .unknown
    }

    /// Every real case, for pickers. `.unknown` is never something a user should choose.
    static var knownCases: [Self] { allCases.filter { $0 != .unknown } }
}
