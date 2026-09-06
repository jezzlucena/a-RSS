import SwiftUI

/// Mirrors apps/web/src/pages/Feed.tsx: masthead, controls, cards, infinite scroll, passive
/// refresh, the "N new" pill, keyboard shortcuts, and detail navigation.
struct FeedView: View {
    @Environment(FeedStore.self) private var feed
    @Environment(SourcesStore.self) private var sources
    @Environment(AppNavigation.self) private var navigation
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.usesSplitLayout) private var usesSplitLayout
    @Environment(\.openURL) private var openURL

    @State private var showScopePicker = false
    @State private var detailID: String?

    private var isCompact: Bool { !usesSplitLayout }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    FeedMasthead().id("top")

                    if let error = feed.error {
                        ErrorBanner(message: error) { Task { await feed.loadInitial() } }
                            .padding(.vertical, 16)
                    }

                    if !feed.loading, feed.entries.isEmpty, feed.error == nil {
                        EmptyState(
                            kicker: "No copy yet",
                            title: "The morning edition is empty.",
                            body: "Add a source or wait for the next poll cycle. Stories arrive after the next pass."
                        )
                    }

                    ForEach(feed.entries) { entry in
                        EntryCardView(entry: entry, onOpenDetail: { detailID = $0 })
                            .id(entry.id)
                        Rectangle().fill(Color.rule).frame(height: 1)
                    }

                    if feed.loading {
                        HStack(spacing: 10) {
                            ProgressView().tint(.vermilion)
                            KickerText(feed.entries.isEmpty ? "Loading" : "Loading more")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 32)
                    }
                    Color.clear.frame(height: 1)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.immediately)
            .refreshable { await feed.reload() }
            // Web: an IntersectionObserver with rootMargin 200px; load when within 200pt of the end.
            .onScrollGeometryChange(for: Bool.self) { geometry in
                geometry.contentOffset.y + geometry.containerSize.height >= geometry.contentSize.height - 200
            } action: { _, nearEnd in
                if nearEnd { Task { await feed.loadMore() } }
            }
            .onChange(of: feed.scrollRequest) { _, request in
                guard let request else { return }
                withAnimation(.smooth) {
                    switch request.target {
                    case .top: proxy.scrollTo("top", anchor: .top)
                    case .entry(let id): proxy.scrollTo(id, anchor: .top)
                    }
                }
            }
        }
        .background(Color.paper)
        .overlay(alignment: .top) {
            if !feed.pendingEntries.isEmpty {
                NewEntriesPill(count: feed.pendingEntries.count) { feed.commitPending() }
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: feed.pendingEntries.isEmpty)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .navigationDestination(item: $detailID) { id in EntryDetailView(id: id) }
        .sheet(isPresented: $showScopePicker) { ScopePickerSheet() }
        .task(id: feed.scope) { await feed.loadInitial() }
        .task(id: scenePhase) { await refreshLoop() }
        // Leaving the feed (detail push, tab switch) is the web's "card unmounted while
        // expanded" → auto-mark-read runs through `collapse()`.
        .onDisappear { feed.collapse() }
        .focusable()
        .focusEffectDisabled()
        .onKeyPress(characters: CharacterSet(charactersIn: "jkmfo"), phases: .down) { press in
            handleKey(press)
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            FeedTitle(title: sources.title(for: feed.scope), unreadCount: feed.unreadCount)
        }
        if isCompact {
            ToolbarItem(placement: .topBarLeading) {
                Button("Choose feed", systemImage: "line.3.horizontal.decrease") { showScopePicker = true }
            }
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                Task { await feed.pollFeed() }
            } label: {
                if feed.polling {
                    ProgressView().tint(.vermilion)
                } else {
                    Image(systemName: "arrow.clockwise")
                }
            }
            .accessibilityLabel(feed.polling ? "Fetching new stories…" : "Fetch new stories")
            .help("Trigger a poll cycle for this view's sources")
            .disabled(feed.polling || feed.loading)

            Menu("Mark read", systemImage: "checkmark.circle") {
                Section("Mark read") {
                    Button("All Here") { Task { await feed.markBulkRead(.all) } }
                    Button("1+ Days") { Task { await feed.markBulkRead(.olderThan1d) } }
                    Button("7+ Days") { Task { await feed.markBulkRead(.olderThan7d) } }
                }
            }
        }
    }

    /// Web: `setInterval` 60 s while the tab is visible, plus an immediate refresh on refocus.
    private func refreshLoop() async {
        guard scenePhase == .active else { return }
        await feed.refresh()
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(60))
            guard !Task.isCancelled else { return }
            await feed.refresh()
        }
    }

    /// j/k expand next/previous, m toggles read, f opens the detail view, o opens the source.
    /// Only fires with the scroll view focused (a focused text field takes the keys instead).
    private func handleKey(_ press: KeyPress) -> KeyPress.Result {
        guard press.modifiers.isEmpty, !feed.entries.isEmpty else { return .ignored }
        switch press.characters {
        case "j": feed.moveExpansion(by: 1)
        case "k": feed.moveExpansion(by: -1)
        case "m":
            guard let id = feed.expandedID else { return .ignored }
            Task { await feed.toggleRead(id) }
        case "f":
            guard let id = feed.expandedID else { return .ignored }
            detailID = id
        case "o":
            guard let id = feed.expandedID, let entry = feed.entry(id: id), let url = URL(string: entry.url) else { return .ignored }
            openURL(url)
        default: return .ignored
        }
        return .handled
    }
}

/// The navigation-bar title: scope name plus the unread pill (the web masthead kicker + pill).
struct FeedTitle: View {
    let title: String
    let unreadCount: Int

    var body: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.ink)
                .lineLimit(1)
            Text(String(unreadCount))
                .font(.chip)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(Color.vermilion, in: Capsule())
                .foregroundStyle(.white)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(unreadCount) unread")
    }
}

/// The filter/order controls under the navigation bar (the web masthead minus its title,
/// which now lives in the bar).
struct FeedMasthead: View {
    @Environment(FeedStore.self) private var feed

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Picker("Filter entries", selection: Binding(
                    get: { feed.filter },
                    set: { filter in Task { await feed.setFilter(filter) } }
                )) {
                    ForEach(FeedStore.Filter.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 200)
                Spacer()
                Button {
                    Task { await feed.toggleOrder() }
                } label: {
                    Label(feed.order == .desc ? "New" : "Old", systemImage: "arrow.up")
                        .font(.chip)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel(feed.order == .desc ? "Sorted newest first — switch to oldest first" : "Sorted oldest first — switch to newest first")
            }
            Rectangle().fill(Color.ink).frame(height: 2)
        }
        .padding(.top, 8)
        .padding(.bottom, 4)
    }
}

/// The floating "↑ N new articles" pill — the feed's one deliberate piece of floating glass.
struct NewEntriesPill: View {
    let count: Int
    let action: () -> Void

    var body: some View {
        GlassEffectContainer {
            Button(action: action) {
                Label("\(count) new article\(count == 1 ? "" : "s")", systemImage: "arrow.up")
                    .font(.chip)
                    .padding(.horizontal, 6)
            }
            .buttonStyle(.glassProminent)
        }
    }
}
