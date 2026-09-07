import Foundation

/// Window geometry the Mac title-bar toolbar needs but can't measure itself: the sidebar's
/// current width decides whether the toolbar shows the full wordmark or just the logo.
@Observable
final class LayoutMetrics {
    var sidebarWidth: CGFloat = 0
}
