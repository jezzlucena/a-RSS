import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Binding var pendingMagicToken: String?

    var body: some View {
        Group {
            switch auth.status {
            case .unknown:
                ProgressView("Loading…")
            case .anonymous:
                LoginView()
            case .authenticated:
                MainTabView()
            }
        }
        .sheet(item: pendingMagicTokenBinding) { wrapped in
            MagicConsumeView(token: wrapped.token)
        }
    }

    // Wrap the optional String in an Identifiable struct for `.sheet(item:)`.
    private var pendingMagicTokenBinding: Binding<MagicTokenWrapper?> {
        Binding<MagicTokenWrapper?>(
            get: { pendingMagicToken.map { MagicTokenWrapper(token: $0) } },
            set: { newValue in pendingMagicToken = newValue?.token }
        )
    }
}

private struct MagicTokenWrapper: Identifiable {
    var id: String { token }
    let token: String
}
