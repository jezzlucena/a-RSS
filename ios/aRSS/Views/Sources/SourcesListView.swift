import SwiftUI

struct SourcesListView: View {
    @Environment(SourcesStore.self) private var sources

    var body: some View {
        NavigationStack {
            List {
                if sources.sources.isEmpty {
                    ContentUnavailableView(
                        "No sources yet",
                        systemImage: "tray",
                        description: Text("Add feeds from the web UI for now.")
                    )
                }
                ForEach(sources.sources) { source in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(source.title).font(.headline)
                        Text(source.feedUrl)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        if let categoryName = sources.categories.first(where: { $0.id == source.categoryId })?.name {
                            Text(categoryName)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
            }
            .navigationTitle("Sources")
            .refreshable { await sources.load() }
        }
    }
}
