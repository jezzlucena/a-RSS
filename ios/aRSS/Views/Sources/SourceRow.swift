import SwiftUI

/// One source: editable title (commit on submit or focus loss, skipped when empty/unchanged),
/// feed URL, category and bypass pickers, and refresh/delete actions.
struct SourceRow: View {
    let source: Source

    @Environment(SourcesStore.self) private var sources
    @Environment(FeedStore.self) private var feed
    @Environment(AppNavigation.self) private var navigation
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.usesSplitLayout) private var usesSplitLayout

    @State private var draftTitle: String
    @FocusState private var titleFocused: Bool
    @State private var refreshing = false
    @State private var confirmDelete = false

    init(source: Source) {
        self.source = source
        _draftTitle = State(initialValue: source.title)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ColorDot(hex: sources.category(id: source.categoryId)?.color)
                TextField("Title", text: $draftTitle)
                    .font(.headlineSerif)
                    .foregroundStyle(Color.ink)
                    .focused($titleFocused)
                    .submitLabel(.done)
                    .onSubmit { commitTitle() }
                    .accessibilityHint("Edit display name")
                Spacer(minLength: 0)
                if refreshing { ProgressView().controlSize(.small) }
            }
            Text(source.feedUrl)
                .font(.chip)
                .foregroundStyle(Color.muted)
                .lineLimit(1)
                .truncationMode(.middle)
            HStack(spacing: 12) {
                Picker("Category", selection: categoryBinding) {
                    Text("Uncategorized").tag(String?.none)
                    ForEach(sources.categories) { category in
                        Text(category.name).tag(Optional(category.id))
                    }
                }
                Picker("Paywall bypass strategy", selection: bypassBinding) {
                    ForEach(BypassStrategy.knownCases, id: \.self) { strategy in
                        Text(strategy.label).tag(strategy)
                    }
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .font(.chip)
            .tint(Color.ink)
        }
        .padding(.vertical, 4)
        .onChange(of: titleFocused) { _, focused in
            if !focused { commitTitle() }
        }
        .onChange(of: source.title) { _, title in
            if !titleFocused { draftTitle = title }
        }
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button("Show feed", systemImage: "newspaper") { showFeed() }.tint(.vermilion)
        }
        .swipeActions(edge: .trailing) {
            Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
            Button("Refresh", systemImage: "arrow.clockwise") { Task { await refresh() } }.tint(.ink)
        }
        .contextMenu {
            Button("Show feed", systemImage: "newspaper") { showFeed() }
            Button("Refresh", systemImage: "arrow.clockwise") { Task { await refresh() } }
            Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
        }
        .confirmationDialog("Remove \"\(source.title)\"?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Remove", role: .destructive) { Task { await delete() } }
        }
    }

    private var categoryBinding: Binding<String?> {
        Binding(
            get: { source.categoryId },
            set: { newValue in
                Task { await update(UpdateSourceRequest(categoryId: newValue.map { .set($0) } ?? .clear)) }
            }
        )
    }

    private var bypassBinding: Binding<BypassStrategy> {
        Binding(
            get: { source.bypassStrategy },
            set: { newValue in Task { await update(UpdateSourceRequest(bypassStrategy: newValue)) } }
        )
    }

    private func showFeed() {
        feed.select(.source(source.id))
        navigation.showFeed(compact: !usesSplitLayout)
    }

    private func commitTitle() {
        let next = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !next.isEmpty, next != source.title else {
            draftTitle = source.title
            return
        }
        Task {
            do {
                try await sources.updateSource(id: source.id, UpdateSourceRequest(title: String(next.prefix(200))))
            } catch {
                draftTitle = source.title
                toasts.report(error, fallback: "Could not rename source")
            }
        }
    }

    private func update(_ patch: UpdateSourceRequest) async {
        do {
            try await sources.updateSource(id: source.id, patch)
        } catch {
            toasts.report(error, fallback: "Could not update source")
        }
    }

    private func refresh() async {
        refreshing = true
        defer { refreshing = false }
        do {
            try await sources.refreshSource(id: source.id)
        } catch {
            toasts.report(error, fallback: "Could not refresh source")
        }
    }

    private func delete() async {
        do {
            try await sources.deleteSource(id: source.id)
        } catch {
            toasts.report(error, fallback: "Could not remove source")
        }
    }
}
