import Foundation

/// Which slice of the feed is shown. Wire format (`feedView` in packages/shared/src/feeds.ts)
/// is `all` | `category:<id>` | `source:<id>`.
nonisolated enum FeedScope: Hashable, Sendable {
    case all
    case category(String)
    case source(String)

    var queryValue: String {
        switch self {
        case .all: "all"
        case .category(let id): "category:\(id)"
        case .source(let id): "source:\(id)"
        }
    }

    init?(queryValue: String) {
        if queryValue == "all" { self = .all; return }
        let parts = queryValue.split(separator: ":", maxSplits: 1).map(String.init)
        guard parts.count == 2, !parts[1].isEmpty else { return nil }
        switch parts[0] {
        case "category": self = .category(parts[1])
        case "source": self = .source(parts[1])
        default: return nil
        }
    }
}
