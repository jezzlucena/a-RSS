import SwiftUI

struct MagicConsumeView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss
    let token: String

    @State private var state: ConsumeState = .pending

    private enum ConsumeState {
        case pending
        case success
        case failure(String)
    }

    var body: some View {
        VStack(spacing: 16) {
            switch state {
            case .pending:
                ProgressView("Signing you in…")
            case .success:
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.green)
                Text("Signed in.")
            case .failure(let message):
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.red)
                Text(message)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                Button("Close") { dismiss() }
            }
        }
        .padding()
        .task {
            let ok = await auth.consumeMagic(token: token)
            state = ok ? .success : .failure(auth.lastError ?? "This link is invalid or expired.")
            if ok {
                try? await Task.sleep(for: .seconds(1))
                dismiss()
            }
        }
    }
}
