import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.colorScheme) private var colorScheme

    @State private var email = ""
    @State private var password = ""
    @State private var pending: PendingState = .none
    @State private var magicSent = false
    @State private var showSignup = false

    private enum PendingState { case none, login, magic }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                }
                Section {
                    Button(action: { Task { await login() } }) {
                        if pending == .login { ProgressView() } else { Text("Sign in") }
                    }
                    .disabled(email.isEmpty || password.isEmpty || pending != .none)

                    Button(action: { Task { await sendMagic() } }) {
                        if pending == .magic { ProgressView() } else { Text("Send magic link") }
                    }
                    .disabled(email.isEmpty || pending != .none)
                }
                if magicSent {
                    Section {
                        Label("If that email exists, a sign-in link is on its way.",
                              systemImage: "envelope.badge")
                            .foregroundStyle(.green)
                    }
                }
                if let err = auth.lastError {
                    Section {
                        Label(err, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }
                Section {
                    SignInWithAppleButton(
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
                Section {
                    Button(action: { Task { await signInWithGoogle() } }) {
                        Label("Continue with Google", systemImage: "g.circle")
                    }
                    .disabled(!GoogleSignInService.isConfigured || pending != .none)
                    if !GoogleSignInService.isConfigured {
                        Text("Set GOOGLE_CLIENT_ID + GOOGLE_REVERSED_CLIENT_ID in your build settings to enable Google sign-in.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Section {
                    Button("Create an account") { showSignup = true }
                }
            }
            .navigationTitle("Sign in to a-RSS")
            .sheet(isPresented: $showSignup) {
                SignupView()
            }
        }
    }

    private func login() async {
        pending = .login
        defer { pending = .none }
        await auth.login(email: email, password: password)
    }

    private func sendMagic() async {
        pending = .magic
        let ok = await auth.requestMagic(email: email)
        magicSent = ok
        pending = .none
    }

    private func signInWithGoogle() async {
        do {
            guard let idToken = try await GoogleSignInService.signIn() else { return }
            await auth.loginWithGoogle(idToken: idToken)
        } catch {
            // Errors surface via auth.lastError on subsequent calls; no direct setter.
        }
    }

    private func handleAppleAuth(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authResult):
            guard
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
        case .failure:
            // User cancelled or system error; ignore silently — Apple's button shows its own UX.
            break
        }
    }
}
