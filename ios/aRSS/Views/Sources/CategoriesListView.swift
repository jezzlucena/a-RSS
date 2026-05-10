import SwiftUI

struct CategoriesListView: View {
    @Environment(SourcesStore.self) private var sources

    var body: some View {
        NavigationStack {
            List {
                if sources.categories.isEmpty {
                    ContentUnavailableView(
                        "No categories yet",
                        systemImage: "folder",
                        description: Text("Create categories from the web UI for now.")
                    )
                }
                ForEach(sources.categories) { c in
                    HStack {
                        Circle()
                            .fill(Color(hex: c.color ?? "#94a3b8"))
                            .frame(width: 12, height: 12)
                        Text(c.name)
                        Spacer()
                        Text("\(sources.sources.filter { $0.categoryId == c.id }.count)")
                            .foregroundStyle(.secondary)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Categories")
            .refreshable { await sources.load() }
        }
    }
}

private extension Color {
    init(hex: String) {
        var trimmed = hex
        if trimmed.hasPrefix("#") { trimmed.removeFirst() }
        guard trimmed.count == 6, let value = UInt64(trimmed, radix: 16) else {
            self = .gray
            return
        }
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self = Color(red: r, green: g, blue: b)
    }
}
