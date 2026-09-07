import SwiftUI

/// The web sidebar (components/Layout.tsx) as a native selectable list: "All sources", a flat
/// category list, a flat source list, each with an unread badge. Section headers carry a
/// manage button for the corresponding screen. On macOS 26 the sidebar renders in Liquid
/// Glass and rows get the system selection highlight.
struct SidebarView: View {
    @Environment(SourcesStore.self) private var sources
    @Environment(FeedStore.self) private var feed
    @Environment(LayoutMetrics.self) private var metrics

    var onSelect: (FeedScope) -> Void
    var onOpen: (Route) -> Void

    private var selection: Binding<FeedScope?> {
        Binding(
            get: { feed.scope },
            set: { scope in if let scope { onSelect(scope) } } // ignore deselection (⌘-click on the Mac)
        )
    }

    var body: some View {
        List(selection: selection) {
            Section {
                Label("All sources", systemImage: "tray.full")
                    .badge(badge(sources.unreadCounts.all))
                    .tag(FeedScope.all)
            }
            Section {
                ForEach(sources.categories) { category in
                    HStack(spacing: 10) {
                        ColorDot(hex: category.color)
                        Text(category.name).lineLimit(1)
                    }
                    .badge(badge(sources.unreadCounts.categories[category.id] ?? 0))
                    .tag(FeedScope.category(category.id))
                }
            } header: {
                sectionHeader("Categories", route: .categories)
            }
            Section {
                ForEach(sources.sources) { source in
                    Text(source.title)
                        .lineLimit(1)
                        .badge(badge(sources.unreadCounts.sources[source.id] ?? 0))
                        .tag(FeedScope.source(source.id))
                }
            } header: {
                sectionHeader("Sources", route: .sources)
            }
        }
        .listStyle(.sidebar)
        .refreshable { await sources.load() }
        // The Mac toolbar sizes its wordmark item from this.
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { metrics.sidebarWidth = $0 }
    }

    /// Hidden at zero, capped at "999+" — the web's `UnreadBadge`.
    private func badge(_ count: Int) -> Text? {
        count > 0 ? Text(count > 999 ? "999+" : String(count)) : nil
    }

    private func sectionHeader(_ title: String, route: Route) -> some View {
        HStack {
            KickerText(title, color: .ink)
            Spacer()
            Button("Manage \(title.lowercased())", systemImage: "slider.horizontal.3") { onOpen(route) }
                .labelStyle(.iconOnly)
                .buttonStyle(.plain)
                .font(.caption)
                .foregroundStyle(Color.muted)
        }
    }
}

/// Compact-width stand-in for the sidebar: the same lists inside a sheet.
struct ScopePickerSheet: View {
    @Environment(FeedStore.self) private var feed
    @Environment(AppNavigation.self) private var navigation
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            SidebarView(
                onSelect: { scope in
                    feed.select(scope)
                    dismiss()
                },
                onOpen: { route in
                    dismiss()
                    navigation.open(route, compact: true)
                }
            )
            .navigationTitle("Read")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
