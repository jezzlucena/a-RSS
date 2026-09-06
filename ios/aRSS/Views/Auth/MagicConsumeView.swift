import SwiftUI

/// Mirrors apps/web/src/pages/MagicConsume.tsx. Presented as a sheet whenever a magic-link
/// token arrives (URL scheme or pasted link); dismisses itself once the session is live.
struct MagicConsumeView: View {
    let token: String?

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    private enum State: Equatable { case pending, failed(String) }
    @SwiftUI.State private var state: State = .pending

    var body: some View {
        VStack(spacing: 20) {
            KickerText("Magic link")
            switch state {
            case .pending:
                ProgressView("Signing you in…")
                    .tint(.vermilion)
            case .failed(let message):
                Text(message)
                    .font(.bodySerif)
                    .foregroundStyle(Color.vermilionDeep)
                    .multilineTextAlignment(.center)
                Button("← Back to sign in") { dismiss() }
                    .buttonStyle(.glass)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.paper.ignoresSafeArea())
        .presentationDetents([.medium])
        .task { await consume() }
    }

    private func consume() async {
        guard let token, !token.isEmpty else {
            state = .failed("Missing token")
            return
        }
        do {
            try await auth.consumeMagicLink(token: token)
            if auth.status == .authenticated {
                dismiss()
            } else {
                state = .failed("Could not sign you in")
            }
        } catch {
            state = .failed(error.userMessage(fallback: "This link is invalid or expired."))
        }
    }
}
