import SwiftUI

/// Whether the current window shows the sidebar-plus-feed layout (true) or the tab bar (false).
/// Set once by `MainScaffold`; screens read it instead of re-deriving size classes so the
/// "switch to the Feed tab" and "push a manager screen" actions agree with what's on screen.
private struct UsesSplitLayoutKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var usesSplitLayout: Bool {
        get { self[UsesSplitLayoutKey.self] }
        set { self[UsesSplitLayoutKey.self] = newValue }
    }
}
