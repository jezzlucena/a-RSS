import SwiftUI

/// Mirrors apps/web/src/pages/Signup.tsx.
struct SignupView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var pending = false
    @State private var error: String?

    var body: some View {
        AuthScaffold(heading: "Create an account") {
            VStack(alignment: .leading, spacing: 20) {
                FormField(label: "Email") {
                    TextField("you@example.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                FormField(label: "Password (8+ chars)") {
                    SecureField("••••••••", text: $password)
                        .textContentType(.newPassword)
                }
                FormField(label: "Display name (optional)") {
                    TextField("Ada", text: $displayName)
                        .textContentType(.name)
                }

                if let error {
                    ErrorBanner(message: error)
                }

                Button {
                    Task { await submit() }
                } label: {
                    Text(pending ? "Creating account…" : "Create account")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(pending)

                HStack(spacing: 4) {
                    Text("Already have an account?").font(.callout).foregroundStyle(Color.muted)
                    Button("Sign in →") { dismiss() }
                        .font(.callout.weight(.semibold))
                        .buttonStyle(.plain)
                        .foregroundStyle(Color.vermilion)
                }
                .padding(.top, 8)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private func submit() async {
        error = nil
        // The web relies on the browser's `required` / `minLength=8`; enforce the same here.
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Enter an email"
            return
        }
        guard password.count >= 8 else {
            error = "Password must be at least 8 characters"
            return
        }
        pending = true
        defer { pending = false }
        do {
            try await auth.signup(email: email, password: password, displayName: displayName)
        } catch {
            self.error = error.userMessage(fallback: "Sign up failed")
        }
    }
}
