import SwiftUI

/// Mirrors apps/web/src/pages/Categories.tsx.
struct CategoriesView: View {
    @Environment(SourcesStore.self) private var sources

    @State private var name = ""
    @State private var color: Color = Color(hex: "#C9412B") ?? .vermilion
    @State private var creating = false
    @State private var createError: String?

    var body: some View {
        List {
            Section {
                TextField("Name", text: $name)
                    .onChange(of: name) { _, value in
                        if value.count > 64 { name = String(value.prefix(64)) }
                    }
                    .submitLabel(.done)
                    .onSubmit { Task { await create() } }
                ColorPicker("Color", selection: $color, supportsOpacity: false)
                if let createError {
                    ErrorBanner(message: createError)
                }
                Button {
                    Task { await create() }
                } label: {
                    Text(creating ? "Adding…" : "Add section").frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassProminent)
                .disabled(creating || name.trimmingCharacters(in: .whitespaces).isEmpty)
            } header: {
                KickerText("Add a section")
            }

            Section {
                if sources.hasLoaded, sources.categories.isEmpty {
                    Text("No categories yet.")
                        .font(.bodySerif.italic())
                        .foregroundStyle(Color.muted)
                }
                ForEach(sources.categories) { category in
                    CategoryRow(category: category)
                }
            } header: {
                KickerText("Categories")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.paper.ignoresSafeArea())
        .navigationTitle("Categories")
        .refreshable { await sources.load() }
        .task { if !sources.hasLoaded { await sources.load() } }
    }

    /// Web: the color is always sent (even untouched) and only the name resets on success.
    private func create() async {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        creating = true
        createError = nil
        defer { creating = false }
        do {
            _ = try await sources.createCategory(name: trimmed, color: color.hexString())
            name = ""
        } catch {
            createError = error.userMessage(fallback: "Could not create category")
        }
    }
}

/// Swatch with live preview and a single debounced PATCH, inline rename, source count, delete.
struct CategoryRow: View {
    let category: Category

    @Environment(SourcesStore.self) private var sources
    @Environment(FeedStore.self) private var feed
    @Environment(AppNavigation.self) private var navigation
    @Environment(ToastCenter.self) private var toasts
    @Environment(\.usesSplitLayout) private var usesSplitLayout

    @State private var draftName: String
    @State private var draftColor: Color
    @FocusState private var nameFocused: Bool
    @State private var confirmDelete = false

    init(category: Category) {
        self.category = category
        _draftName = State(initialValue: category.name)
        _draftColor = State(initialValue: Color(hex: category.color ?? "") ?? .uncategorizedDot)
    }

    var body: some View {
        HStack(spacing: 12) {
            ColorPicker("Color", selection: $draftColor, supportsOpacity: false)
                .labelsHidden()
                .frame(width: 32)
                .accessibilityHint("Change color")
            TextField("Name", text: $draftName)
                .font(.headlineSerif)
                .foregroundStyle(Color.ink)
                .focused($nameFocused)
                .submitLabel(.done)
                .onSubmit { commitName() }
                .onChange(of: draftName) { _, value in
                    if value.count > 64 { draftName = String(value.prefix(64)) }
                }
            Spacer()
            Text(sourceCountLabel)
                .font(.chip)
                .foregroundStyle(Color.muted)
        }
        .padding(.vertical, 4)
        .onChange(of: nameFocused) { _, focused in
            if !focused { commitName() }
        }
        .onChange(of: category.name) { _, name in
            if !nameFocused { draftName = name }
        }
        // The web previews on `input` and PATCHes once on `change` (picker closed). SwiftUI's
        // picker has no close event, so debounce and send only when the hex actually changed.
        .task(id: draftColor) {
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled, let hex = draftColor.hexString() else { return }
            guard hex.caseInsensitiveCompare(category.color ?? "") != .orderedSame else { return }
            do {
                try await sources.updateCategory(id: category.id, UpdateCategoryRequest(color: hex))
            } catch {
                toasts.report(error, fallback: "Could not update category color")
            }
        }
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button("Show feed", systemImage: "newspaper") { showFeed() }.tint(.vermilion)
        }
        .swipeActions(edge: .trailing) {
            Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
        }
        .contextMenu {
            Button("Show feed", systemImage: "newspaper") { showFeed() }
            Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
        }
        .confirmationDialog(
            "Delete category \"\(category.name)\"? Sources will become uncategorized.",
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) { Task { await delete() } }
        }
    }

    private var sourceCountLabel: String {
        let count = sources.sourceCount(categoryId: category.id)
        return "\(count) source\(count == 1 ? "" : "s")"
    }

    private func showFeed() {
        feed.select(.category(category.id))
        navigation.showFeed(compact: !usesSplitLayout)
    }

    private func commitName() {
        let next = draftName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !next.isEmpty, next != category.name else {
            draftName = category.name
            return
        }
        Task {
            do {
                try await sources.updateCategory(id: category.id, UpdateCategoryRequest(name: next))
            } catch {
                draftName = category.name
                toasts.report(error, fallback: "Could not rename category")
            }
        }
    }

    private func delete() async {
        do {
            try await sources.deleteCategory(id: category.id)
        } catch {
            toasts.report(error, fallback: "Could not delete category")
        }
    }
}
