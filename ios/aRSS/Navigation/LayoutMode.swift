import SwiftUI

/// How `MainScaffold` laid the window out. Screens read this instead of re-deriving size
/// classes, so navigation actions and per-layout styling agree with what's on screen.
enum LayoutMode {
    /// iPhone portrait: tab bar.
    case tabs
    /// iPhone landscape: a hand-drawn sidebar beside the feed in very little height.
    case sideBySide
    /// iPad and Mac: the system split view.
    case split
}

private struct LayoutModeKey: EnvironmentKey {
    static let defaultValue = LayoutMode.tabs
}

extension EnvironmentValues {
    var layoutMode: LayoutMode {
        get { self[LayoutModeKey.self] }
        set { self[LayoutModeKey.self] = newValue }
    }

    /// Sidebar-plus-feed (either flavor) rather than the tab bar.
    var usesSplitLayout: Bool { layoutMode != .tabs }
}
