import SwiftUI

@main
struct aRSSApp: App {
    @State private var auth = AuthStore()
    @State private var pendingMagicToken: String?

    var body: some Scene {
        WindowGroup {
            RootView(pendingMagicToken: $pendingMagicToken)
                .environment(auth)
                .task {
                    if auth.status == .unknown {
                        await auth.hydrate()
                    }
                }
                .onOpenURL { url in
                    handleIncoming(url: url)
                }
        }
    }

    private func handleIncoming(url: URL) {
        // Let GoogleSignIn handle its OAuth callback first.
        if GoogleSignInService.handle(url: url) { return }

        // arss://auth/magic?t=<token>
        guard url.scheme == "arss",
              url.host == "auth",
              url.path == "/magic",
              let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first(where: { $0.name == "t" })?
                .value
        else { return }
        pendingMagicToken = token
    }
}
