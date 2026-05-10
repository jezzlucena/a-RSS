import SwiftUI

struct FeedScreen: View {
    @Environment(FeedStore.self) private var feed
    @Environment(SourcesStore.self) private var sources

    var body: some View {
        @Bindable var feed = feed
        List {
            if feed.entries.isEmpty && !feed.loading {
                ContentUnavailableView(
                    "Nothing here yet",
                    systemImage: "newspaper",
                    description: Text("Add a source or wait for the next poll cycle.")
                )
            }
            ForEach(feed.entries) { entry in
                NavigationLink(value: EntryRoute(id: entry.id)) {
                    EntryCardView(entry: entry)
                }
                .listRowSeparator(.hidden)
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button {
                        Task { _ = await feed.toggleRead(entry) }
                    } label: {
                        if entry.isRead {
                            Label("Unread", systemImage: "circle")
                        } else {
                            Label("Read", systemImage: "checkmark.circle")
                        }
                    }
                    .tint(entry.isRead ? .gray : .accentColor)
                }
                .onAppear {
                    if entry.id == feed.entries.last?.id {
                        Task { await feed.loadMore() }
                    }
                }
            }
        }
        .listStyle(.plain)
        .refreshable { await feed.loadInitial() }
        .navigationTitle(navigationTitle)
        .navigationDestination(for: EntryRoute.self) { route in
            EntryDetailView(entryId: route.id)
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Menu {
                    Button {
                        select(.all)
                    } label: {
                        Label("All sources", systemImage: "newspaper")
                    }
                    if !sources.categories.isEmpty {
                        Section("Categories") {
                            ForEach(sources.categories) { c in
                                Button(c.name) { select(.category(c.id)) }
                            }
                        }
                    }
                    if !sources.sources.isEmpty {
                        Section("Sources") {
                            ForEach(sources.sources) { s in
                                Button(s.title) { select(.source(s.id)) }
                            }
                        }
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Order", selection: Binding(
                        get: { feed.order },
                        set: { newValue in
                            feed.setViewAndOrder(feed.view, newValue)
                            Task { await feed.loadInitial() }
                        }
                    )) {
                        Text("Newest first").tag(FeedOrder.desc)
                        Text("Oldest first").tag(FeedOrder.asc)
                    }
                    Section("Mark read…") {
                        Button("All entries in this view") {
                            Task { _ = await feed.markBulkRead(scope: .all) }
                        }
                        Button("1 day or older") {
                            Task { _ = await feed.markBulkRead(scope: .olderThan1d) }
                        }
                        Button("7 days or older") {
                            Task { _ = await feed.markBulkRead(scope: .olderThan7d) }
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .task {
            if feed.entries.isEmpty {
                await feed.loadInitial()
            }
        }
    }

    private var navigationTitle: String {
        switch feed.view {
        case .all: return "All sources"
        case .category(let id):
            return sources.categories.first(where: { $0.id == id })?.name ?? "Category"
        case .source(let id):
            return sources.sources.first(where: { $0.id == id })?.title ?? "Source"
        }
    }

    private func select(_ v: FeedView) {
        feed.setViewAndOrder(v, feed.order)
        Task { await feed.loadInitial() }
    }
}
