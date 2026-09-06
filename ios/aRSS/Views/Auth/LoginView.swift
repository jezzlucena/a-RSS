import AuthenticationServices
import SwiftUI

/// Mirrors apps/web/src/pages/Login.tsx, plus native Apple sign-in and a "paste link" path
/// for magic links (the email links to the web app, not to the `arss://` scheme).
struct LoginView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.colorScheme) private var colorScheme

    private enum Pending { case none, login, magic, google, apple }

    @State private var email = ""
    @State private var password = ""
    @State private var pending: Pending = .none
    @State private var error: String?
    @State private var magicSent = false
    @State private var showSignup = false
    @State private var showPasteLink = false
    @State private var pastedLink = ""
    @State private var magicToken: MagicToken?

    private var busy: Bool { pending != .none }

    var body: some View {
        NavigationStack {
            AuthScaffold(heading: "Sign in") {
                VStack(alignment: .leading, spacing: 20) {
                    FormField(label: "Email") {
                        TextField("you@example.com", text: $email)
                            .accessibilityIdentifier("login.email")
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    FormField(label: "Password") {
                        SecureField("••••••••", text: $password)
                            .accessibilityIdentifier("login.password")
                            .textContentType(.password)
                            .onSubmit { Task { await signIn() } }
                    }

                    if magicSent {
                        StatusText(message: "If that email exists, a sign-in link is on its way.")
                    }
                    if let error {
                        ErrorBanner(message: error)
                    }

                    Button {
                        Task { await signIn() }
                    } label: {
                        Text(pending == .login ? "Signing in…" : "Sign in")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
                    .disabled(busy)
                    .accessibilityIdentifier("login.submit")

                    Button {
                        Task { await sendMagicLink() }
                    } label: {
                        Text(pending == .magic ? "Sending…" : "Send magic link")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glass)
                    .controlSize(.large)
                    .disabled(busy)

                    Button("I have a sign-in link", systemImage: "link") {
                        showPasteLink = true
                    }
                    .font(.chip)
                    .buttonStyle(.plain)
                    .foregroundStyle(Color.muted)

                    HStack {
                        Rectangle().fill(Color.rule).frame(height: 1)
                        KickerText("or")
                        Rectangle().fill(Color.rule).frame(height: 1)
                    }

                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.email, .fullName]
                    } onCompletion: { result in
                        Task { await signInWithApple(result) }
                    }
                    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                    .frame(height: 48)
                    .disabled(busy)

                    if GoogleSignInService.isConfigured {
                        Button {
                            Task { await signInWithGoogle() }
                        } label: {
                            Label(pending == .google ? "Signing in…" : "Continue with Google", systemImage: "g.circle")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.glass)
                        .controlSize(.large)
                        .disabled(busy)
                    } else {
                        StatusText(message: "Set GOOGLE_CLIENT_ID in ios/Local.xcconfig to enable Google sign-in.")
                    }

                    HStack(spacing: 4) {
                        Text("New here?").font(.callout).foregroundStyle(Color.muted)
                        Button("Create an account →") { showSignup = true }
                            .font(.callout.weight(.semibold))
                            .buttonStyle(.plain)
                            .foregroundStyle(Color.vermilion)
                    }
                    .padding(.top, 8)
                }
            }
            .navigationDestination(isPresented: $showSignup) { SignupView() }
            .toolbar(.hidden, for: .navigationBar)
        }
        .alert("Paste your sign-in link", isPresented: $showPasteLink) {
            TextField("https://…/auth/magic?t=…", text: $pastedLink)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("Open") {
                if let token = DeepLink.magicToken(inPastedText: pastedLink) {
                    magicToken = MagicToken(value: token)
                } else {
                    error = "That doesn't look like a sign-in link"
                }
                pastedLink = ""
            }
            Button("Cancel", role: .cancel) { pastedLink = "" }
        } message: {
            Text("Copy the link from the email we sent and paste it here.")
        }
        .sheet(item: $magicToken) { token in
            MagicConsumeView(token: token.value)
        }
    }

    private func signIn() async {
        pending = .login
        error = nil
        defer { pending = .none }
        do {
            try await auth.login(email: email, password: password)
        } catch {
            self.error = error.userMessage(fallback: "Login failed")
        }
    }

    private func sendMagicLink() async {
        let address = email.trimmingCharacters(in: .whitespaces)
        guard !address.isEmpty else {
            error = "Enter an email first"
            return
        }
        pending = .magic
        error = nil
        defer { pending = .none }
        do {
            try await auth.requestMagicLink(email: address)
            magicSent = true
        } catch {
            self.error = error.userMessage(fallback: "Could not send magic link")
        }
    }

    private func signInWithGoogle() async {
        pending = .google
        error = nil
        defer { pending = .none }
        do {
            guard let idToken = try await GoogleSignInService.signIn() else { return }
            try await auth.signInWithGoogle(idToken: idToken)
        } catch {
            self.error = error.userMessage(fallback: "Google sign-in failed")
        }
    }

    private func signInWithApple(_ result: Result<ASAuthorization, any Error>) async {
        pending = .apple
        error = nil
        defer { pending = .none }
        do {
            let authorization = try result.get()
            try await auth.signInWithApple(AppleSignInPayload.request(from: authorization))
        } catch let failure as ASAuthorizationError where failure.code == .canceled {
            return
        } catch {
            self.error = error.userMessage(fallback: "Apple sign-in failed")
        }
    }
}
