import SwiftUI

@main
struct aRSSApp: App {
    @State private var environment = AppEnvironment.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(environment)
                .environment(environment.auth)
                .environment(environment.theme)
                .environment(environment.toasts)
                .environment(environment.sources)
                .environment(environment.feed)
                .environment(environment.summarizer)
                .environment(environment.summarizationPreferences)
        }
    }
}
