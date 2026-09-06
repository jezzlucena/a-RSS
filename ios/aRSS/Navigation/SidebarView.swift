import SwiftUI

/// The web sidebar (components/Layout.tsx): "All sources", then a flat category list, then a
/// flat list of every source — each with an unread badge. Section titles open the managers.
struct SidebarView: View {
    @Environment(SourcesStore.self) private var sources
    @Environment(FeedStore.self) private var feed

    var onSelect: (FeedScope) -> Void
    var onOpen: (Route) -> Void

    var body: some View {
        List {
            Section {
                scopeRow(.all, count: sources.unreadCounts.all) {
                    Label("All sources", systemImage: "tray.full")
                }
            }
            Section {
                ForEach(sources.categories) { category in
                    scopeRow(.category(category.id), count: sources.unreadCounts.categories[category.id] ?? 0) {
                        HStack(spacing: 10) {
                            ColorDot(hex: category.color)
                            Text(category.name).lineLimit(1)
                        }
                    }
                }
            } header: {
                sectionHeader("Categories", route: .categories)
            }
            Section {
                ForEach(sources.sources) { source in
                    scopeRow(.source(source.id), count: sources.unreadCounts.sources[source.id] ?? 0) {
                        Text(source.title).lineLimit(1)
                    }
                }
            } header: {
                sectionHeader("Sources", route: .sources)
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(Color.paperDeep)
        .refreshable { await sources.load() }
    }

    private func sectionHeader(_ title: String, route: Route) -> some View {
        Button {
            onOpen(route)
        } label: {
            HStack {
                KickerText(title, color: .ink)
                Spacer()
                Image(systemName: "chevron.right").font(.caption2).foregroundStyle(Color.muted)
            }
        }
        .buttonStyle(.plain)
        .accessibilityHint("Manage \(title.lowercased())")
    }

    private func scopeRow<Content: View>(_ scope: FeedScope, count: Int, @ViewBuilder label: () -> Content) -> some View {
        let selected = feed.scope == scope
        return Button {
            onSelect(scope)
        } label: {
            HStack {
                label()
                    .font(.body)
                    .foregroundStyle(selected ? Color.vermilion : Color.ink)
                Spacer(minLength: 8)
                UnreadBadge(count: count)
            }
        }
        .buttonStyle(.plain)
        .listRowBackground(selected ? Color.vermilion.opacity(0.10) : Color.clear)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
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
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) { Wordmark(size: .toolbar) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
