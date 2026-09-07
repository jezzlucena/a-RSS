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
    /// Mac overscroll trigger: re-armed once the content settles back below the threshold.
    @State private var pullArmed = true

    private struct ScrollSignals: Equatable {
        var nearEnd: Bool
        var pulledPastTop: Bool
    }
    private static let pullThreshold: CGFloat = 70

    private var isCompact: Bool { !usesSplitLayout }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if isCompact {
                        FeedMasthead().id("top")
                    } else {
                        Color.clear.frame(height: 1).id("top")
                    }

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
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.immediately)
            // Pull-to-refresh does what the Fetch button does: poll the sources, then reload.
            .refreshable { await feed.pollFeed() }
            .onScrollGeometryChange(for: ScrollSignals.self) { geometry in
                ScrollSignals(
                    // Web: an IntersectionObserver with rootMargin 200px; load when within 200pt of the end.
                    nearEnd: geometry.contentOffset.y + geometry.containerSize.height >= geometry.contentSize.height - 200,
                    // Rubber-banding above the top (negative offset past the inset).
                    pulledPastTop: geometry.contentOffset.y + geometry.contentInsets.top < -Self.pullThreshold
                )
            } action: { _, signals in
                if signals.nearEnd { Task { await feed.loadMore() } }
                #if targetEnvironment(macCatalyst)
                // No UIRefreshControl on the Mac: a trackpad overscroll past the top is the pull.
                if signals.pulledPastTop {
                    if pullArmed {
                        pullArmed = false
                        Task { await feed.pollFeed() }
                    }
                } else {
                    pullArmed = true
                }
                #endif
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
        .modifier(FeedChrome())
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
        // ⌘R fetches new stories (the Mac toolbar's Fetch item is a hosted view and can't own
        // a keyboard shortcut of its own).
        .onKeyPress(characters: CharacterSet(charactersIn: "r"), phases: .down) { press in
            guard press.modifiers.contains(.command) else { return .ignored }
            Task { await feed.pollFeed() }
            return .handled
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        #if !targetEnvironment(macCatalyst)
        ToolbarItem(placement: .principal) {
            FeedTitle(title: sources.title(for: feed.scope), unreadCount: feed.unreadCount)
        }
        if isCompact {
            ToolbarItem(placement: .topBarLeading) {
                Button("Choose feed", systemImage: "line.3.horizontal.decrease") { showScopePicker = true }
            }
        } else {
            // Split layouts have a wide title bar: the filter and order controls live there.
            ToolbarItemGroup(placement: .topBarTrailing) {
                FeedControls()
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
            .keyboardShortcut("r", modifiers: .command)
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
        #else
        // Every control lives in the window's title-bar toolbar (MacToolbar); a builder can't be empty.
        ToolbarItem(placement: .topBarTrailing) { EmptyView() }
        #endif
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

/// On the Mac the window's title-bar toolbar (MacToolbar) owns the title, subtitle and every
/// control, so the feed root shows no in-content navigation bar. Elsewhere the bar stays.
struct FeedChrome: ViewModifier {
    func body(content: Content) -> some View {
        #if targetEnvironment(macCatalyst)
        content.toolbar(.hidden, for: .navigationBar)
        #else
        content.navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

/// The All/Unread picker and the order toggle. In compact layouts they sit in the masthead
/// under the navigation bar; in split layouts they move into the (wider) title bar.
struct FeedControls: View {
    @Environment(FeedStore.self) private var feed

    var body: some View {
        Picker("Filter entries", selection: Binding(
            get: { feed.filter },
            set: { filter in Task { await feed.setFilter(filter) } }
        )) {
            ForEach(FeedStore.Filter.allCases) { Text($0.label).tag($0) }
        }
        .pickerStyle(.segmented)
        .frame(width: 160)

        Picker("Order", selection: Binding(
            get: { feed.order },
            set: { order in Task { await feed.setOrder(order) } }
        )) {
            Text("New").tag(FeedOrder.desc)
            Text("Old").tag(FeedOrder.asc)
        }
        .pickerStyle(.segmented)
        .frame(width: 120)
        .accessibilityLabel("Sort order")
    }
}

/// Compact layouts only: the controls row under the navigation bar (the web masthead minus its
/// title, which lives in the bar).
struct FeedMasthead: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                FeedControls()
                Spacer()
            }
            .buttonStyle(.bordered)
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
