import Foundation

/// Destinations pushed onto the regular-width detail stack (the web's /sources, /categories,
/// /settings pages). On compact width these are tabs instead.
enum Route: Hashable {
    case sources
    case categories
    case settings
}

enum CompactTab: Hashable {
    case feed, sources, categories, settings
}

/// Navigation state shared between the scaffold, the sidebar and the feed toolbar, so a row in
/// the Sources tab can switch to the Feed tab, and the sidebar can push manager screens.
@Observable
final class AppNavigation {
    var tab: CompactTab = .feed
    var detailPath: [Route] = []

    func open(_ route: Route, compact: Bool) {
        if compact {
            tab = switch route {
            case .sources: .sources
            case .categories: .categories
            case .settings: .settings
            }
        } else {
            detailPath = [route]
        }
    }

    func showFeed(compact: Bool) {
        if compact { tab = .feed } else { detailPath = [] }
    }
}
