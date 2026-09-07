import SwiftUI

/// Adaptive root for signed-in users.
///
/// - Regular width (iPad, large iPhones in landscape): the system `NavigationSplitView` with
///   the web's sidebar.
/// - Compact width but compact height (any iPhone in landscape): the same sidebar-plus-feed
///   arrangement drawn by hand, because `NavigationSplitView` collapses to one column there.
/// - Compact portrait: a Liquid Glass tab bar.
struct MainScaffold: View {
    private enum Layout { case tabs, systemSplit, sideBySide }

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(SourcesStore.self) private var sources
    @Environment(FeedStore.self) private var feed
    @Environment(AppNavigation.self) private var navigation
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    private var layout: Layout {
        if horizontalSizeClass == .regular { return .systemSplit }
        if verticalSizeClass == .compact { return .sideBySide }
        return .tabs
    }

    private var layoutMode: LayoutMode {
        switch layout {
        case .tabs: .tabs
        case .sideBySide: .sideBySide
        case .systemSplit: .split
        }
    }

    var body: some View {
        Group {
            switch layout {
            case .tabs: tabs
            case .systemSplit: systemSplit
            case .sideBySide: sideBySide
            }
        }
        .environment(\.layoutMode, layoutMode)
        .task { await sources.load() }
    }

    // MARK: Layouts

    private var systemSplit: some View {
        @Bindable var navigation = navigation
        return NavigationSplitView(columnVisibility: $columnVisibility) {
            sidebar
        } detail: {
            detailStack
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var sideBySide: some View {
        HStack(spacing: 0) {
            NavigationStack { sidebar }
                .frame(width: 280)
            Rectangle().fill(Color.rule).frame(width: 1).ignoresSafeArea()
            detailStack
        }
    }

    private var tabs: some View {
        @Bindable var navigation = navigation
        return TabView(selection: $navigation.tab) {
            Tab("Feed", systemImage: "newspaper", value: CompactTab.feed) {
                NavigationStack { FeedView() }
            }
            Tab("Sources", systemImage: "antenna.radiowaves.left.and.right", value: CompactTab.sources) {
                NavigationStack { SourcesView() }
            }
            Tab("Categories", systemImage: "tag", value: CompactTab.categories) {
                NavigationStack { CategoriesView() }
            }
            Tab("Settings", systemImage: "gearshape", value: CompactTab.settings) {
                NavigationStack { SettingsView() }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
    }

    // MARK: Pieces

    @ViewBuilder
    private var sidebar: some View {
        let list = SidebarView(
            onSelect: { scope in
                feed.select(scope)
                navigation.detailPath = []
            },
            onOpen: { route in navigation.open(route, compact: false) }
        )
        .navigationSplitViewColumnWidth(min: 260, ideal: 300, max: 420)

        #if targetEnvironment(macCatalyst)
        // The window's title-bar toolbar (MacToolbar) carries the wordmark and these buttons.
        list.toolbar(.hidden, for: .navigationBar)
        #else
        list
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Wordmark(size: .toolbar) { navigation.goHome(feed: feed, compact: false) }.fixedSize()
                }
                ToolbarItem(placement: .topBarTrailing) { ThemeToggleButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Settings", systemImage: "gearshape") { navigation.toggleSettings(compact: false) }
                        .keyboardShortcut(",", modifiers: .command)
                }
            }
        #endif
    }

    private var detailStack: some View {
        @Bindable var navigation = navigation
        return NavigationStack(path: $navigation.detailPath) {
            FeedView()
                .navigationDestination(for: Route.self) { route in destination(route) }
        }
    }

    @ViewBuilder
    private func destination(_ route: Route) -> some View {
        switch route {
        case .sources: SourcesView()
        case .categories: CategoriesView()
        case .settings: SettingsView()
        }
    }
}

/// The appearance button: shows the current mode and cycles Light → Dark → System.
struct ThemeToggleButton: View {
    @Environment(ThemeStore.self) private var theme

    var body: some View {
        Button {
            theme.cycle()
        } label: {
            ThemeModeGlyph(preference: theme.preference)
        }
        .help("Appearance: \(ThemeModeGlyph.label(for: theme.preference)) — next: \(ThemeModeGlyph.label(for: theme.nextPreference))")
        .accessibilityLabel("Appearance: \(ThemeModeGlyph.label(for: theme.preference))")
        .accessibilityHint("Switches to \(ThemeModeGlyph.label(for: theme.nextPreference))")
    }
}
