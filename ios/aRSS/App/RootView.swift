import SwiftUI

struct MagicToken: Identifiable, Equatable {
    let value: String
    var id: String { value }
}

/// Switches on the auth status (web `RequireAuth`), applies the theme, hosts the toast layer,
/// and routes incoming URLs: magic links to `MagicConsumeView`, everything else to Google.
struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(ThemeStore.self) private var theme
    @State private var magicToken: MagicToken?

    var body: some View {
        Group {
            switch auth.status {
            case .unknown:
                ProgressView("Loading…")
                    .font(.chip)
                    .tint(.vermilion)
            case .anonymous:
                LoginView()
            case .authenticated:
                MainScaffold()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.paper.ignoresSafeArea())
        .tint(.vermilion)
        .preferredColorScheme(theme.colorScheme)
        .overlay(alignment: .top) { ToastOverlay() }
        .task { await auth.hydrate() }
        .onOpenURL { url in
            switch DeepLink.parse(url) {
            case .magic(let token): magicToken = MagicToken(value: token)
            case .other(let url): GoogleSignInService.handle(url)
            }
        }
        .sheet(item: $magicToken) { token in
            MagicConsumeView(token: token.value)
        }
    }
}
