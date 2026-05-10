import SwiftUI
import AuthenticationServices

struct SignupView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var pending = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password (8+ chars)", text: $password)
                        .textContentType(.newPassword)
                    TextField("Display name (optional)", text: $displayName)
                        .textContentType(.name)
                }
                Section {
                    Button(action: { Task { await submit() } }) {
                        if pending { ProgressView() } else { Text("Create account") }
                    }
                    .disabled(pending || email.isEmpty || password.count < 8)
                }
                Section {
                    SignInWithAppleButton(
                        .signUp,
                        onRequest: { request in
                            request.requestedScopes = [.fullName, .email]
                        },
                        onCompletion: { result in
                            Task { await handleAppleAuth(result) }
                        }
                    )
                    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                    .frame(height: 44)
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                }
                if let err = auth.lastError {
                    Section {
                        Label(err, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Sign up")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() async {
        pending = true
        defer { pending = false }
        await auth.signup(
            email: email,
            password: password,
            displayName: displayName.isEmpty ? nil : displayName
        )
        if auth.status == .authenticated {
            dismiss()
        }
    }

    private func handleAppleAuth(_ result: Result<ASAuthorization, Error>) async {
        guard case .success(let authResult) = result,
              let credential = authResult.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8)
        else { return }
        await auth.loginWithApple(
            identityToken: identityToken,
            email: credential.email,
            givenName: credential.fullName?.givenName,
            familyName: credential.fullName?.familyName
        )
        if auth.status == .authenticated {
            dismiss()
        }
    }
}
