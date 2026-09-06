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
    @State private var navigation = AppNavigation()
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    private var layout: Layout {
        if horizontalSizeClass == .regular { return .systemSplit }
        if verticalSizeClass == .compact { return .sideBySide }
        return .tabs
    }

    var body: some View {
        Group {
            switch layout {
            case .tabs: tabs
            case .systemSplit: systemSplit
            case .sideBySide: sideBySide
            }
        }
        .environment(navigation)
        .environment(\.usesSplitLayout, layout != .tabs)
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
                .frame(width: 240)
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

    private var sidebar: some View {
        SidebarView(
            onSelect: { scope in
                feed.select(scope)
                navigation.detailPath = []
            },
            onOpen: { route in navigation.open(route, compact: false) }
        )
        .navigationBarTitleDisplayMode(.inline)
        .navigationSplitViewColumnWidth(min: 200, ideal: 240, max: 280)
        .toolbar {
            ToolbarItem(placement: .principal) { Wordmark(size: .toolbar) }
            ToolbarItem(placement: .topBarTrailing) { ThemeToggleButton() }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Settings", systemImage: "gearshape") { navigation.open(.settings, compact: false) }
            }
        }
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

/// The navbar sun/moon: flips to the explicit opposite of the resolved scheme (web `ThemeToggle`).
struct ThemeToggleButton: View {
    @Environment(ThemeStore.self) private var theme
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(
            colorScheme == .dark ? "Switch to light mode" : "Switch to dark mode",
            systemImage: colorScheme == .dark ? "sun.max" : "moon"
        ) {
            theme.toggle(resolved: colorScheme)
        }
    }
}
