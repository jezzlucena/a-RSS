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
    @Environment(AppEnvironment.self) private var environment
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
        .overlay(alignment: .top) { ToastOverlay() }
        .task { await auth.hydrate() }
        // The Mac title-bar toolbar carries feed controls, so it exists only while signed in.
        .onChange(of: auth.status, initial: true) { _, status in syncMacToolbar(signedIn: status == .authenticated) }
        // The theme is applied as the window's interface style rather than `preferredColorScheme`:
        // the latter doesn't reliably revert to the system appearance when handed nil, and on the
        // Mac only the window style also themes the title bar, Liquid Glass and window border.
        .onChange(of: theme.preference, initial: true) { _, preference in syncWindowAppearance(preference) }
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

    private func syncWindowAppearance(_ preference: ThemePreference) {
        let style: UIUserInterfaceStyle = switch preference {
        case .system: .unspecified
        case .light: .light
        case .dark: .dark
        }
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
            for window in scene.windows where window.overrideUserInterfaceStyle != style {
                window.overrideUserInterfaceStyle = style
            }
        }
    }

    private func syncMacToolbar(signedIn: Bool) {
        #if targetEnvironment(macCatalyst)
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
            if signedIn {
                MacToolbar.install(in: scene, environment: environment)
            } else {
                MacToolbar.uninstall(from: scene)
            }
        }
        #endif
    }
}
