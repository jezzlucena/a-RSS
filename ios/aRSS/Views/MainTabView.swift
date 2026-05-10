import SwiftUI

struct MainTabView: View {
    @State private var sourcesStore = SourcesStore()

    var body: some View {
        TabView {
            FeedTab()
                .environment(sourcesStore)
                .tabItem { Label("Feed", systemImage: "newspaper") }

            SourcesListView()
                .environment(sourcesStore)
                .tabItem { Label("Sources", systemImage: "tray.full") }

            CategoriesListView()
                .environment(sourcesStore)
                .tabItem { Label("Categories", systemImage: "folder") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
        .task { await sourcesStore.load() }
    }
}

private struct FeedTab: View {
    @State private var feedStore = FeedStore()

    var body: some View {
        NavigationStack {
            FeedScreen()
                .environment(feedStore)
        }
    }
}
