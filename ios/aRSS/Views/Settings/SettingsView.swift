import SwiftUI

/// Mirrors apps/web/src/pages/Settings.tsx: account, appearance, Anthropic key, password,
/// diagnostics.
struct SettingsView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(ThemeStore.self) private var theme

    var body: some View {
        @Bindable var theme = theme
        Form {
            Section {
                if let me = auth.me {
                    LabeledContent("Email", value: me.email)
                    if let name = me.displayName, !name.isEmpty {
                        LabeledContent("Name", value: name)
                    }
                    LabeledContent("Sign-in", value: me.authMethods.filter { $0 != .unknown }.map(\.rawValue).joined(separator: " · "))
                }
                Button("Sign out", role: .destructive) { Task { await auth.logout() } }
            } header: {
                KickerText("Account")
            }

            Section {
                Picker("Theme", selection: $theme.preference) {
                    ForEach(ThemePreference.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
            } header: {
                KickerText("Appearance")
            } footer: {
                Text("Choose how a-RSS looks. “System” follows your device's light or dark setting.")
            }

            AIProviderSection()
            OnDeviceSection()
            PasswordSection()
            DiagnosticsSection()
        }
        .scrollContentBackground(.hidden)
        .background(Color.paper.ignoresSafeArea())
        .navigationTitle("Settings")
    }
}

/// Which LLM summarizes for this account and each provider's credentials. Labels, defaults and
/// console links come from `/me` so nothing about vendors is hardcoded here.
struct AIProviderSection: View {
    @Environment(AuthStore.self) private var auth

    @State private var apiKey = ""
    @State private var model = ""
    @State private var baseUrl = ""
    @State private var saving = false
    @State private var status: String?
    @State private var error: String?

    private var active: LLMProviderState? { auth.activeProvider }

    var body: some View {
        Section {
            if let llm = auth.llm, let provider = active {
                Picker("Provider", selection: Binding(
                    get: { llm.provider },
                    set: { id in Task { await select(id) } }
                )) {
                    ForEach(llm.providers.filter { $0.id != .unknown }) { p in
                        Text(p.configured ? "\(p.label) · configured" : p.label).tag(p.id)
                    }
                }
                .disabled(saving)

                LabeledContent("Status", value: provider.configured ? "Configured" : "Not set")

                SecureField(keyLabel(for: provider), text: $apiKey, prompt: Text(provider.keyPlaceholder ?? "API key"))
                    .textContentType(.password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                TextField("Model", text: $model, prompt: Text(provider.defaultModel ?? "Model name"))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                if provider.id == .custom {
                    TextField("Base URL", text: $baseUrl, prompt: Text("http://localhost:11434/v1"))
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                if let status {
                    StatusText(message: status)
                }
                if let error {
                    ErrorBanner(message: error)
                }

                Button(saving ? "Saving…" : "Save") { Task { await save(provider) } }
                    .disabled(!canSave(provider))
                if provider.configured {
                    Button("Remove key", role: .destructive) { Task { await remove(provider) } }
                        .disabled(saving)
                }
            }
        } header: {
            KickerText("AI provider")
        } footer: {
            Text(footer)
        }
        .onChange(of: active?.id, initial: true) { _, _ in seed() }
    }

    private var footer: LocalizedStringKey {
        guard let provider = active else { return "" }
        var text = "Summaries are generated with your own account at the provider you choose. Keys are encrypted at rest and never shown back to you."
        if provider.id == .custom {
            text += " Any OpenAI-compatible endpoint works (Ollama, LM Studio, OpenRouter…); leave the key blank if your server doesn't need one."
        } else if let console = provider.consoleUrl, let host = URL(string: console)?.host {
            text += " Get a key at [\(host)](\(console))."
        }
        if provider.id != .custom {
            text += " Leave the model blank for the default."
        }
        return LocalizedStringKey(text)
    }

    private func keyLabel(for provider: LLMProviderState) -> String {
        if provider.configured { return "Replace key" }
        return provider.requiresKey ? "API key" : "API key (optional)"
    }

    private func canSave(_ provider: LLMProviderState) -> Bool {
        let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let keyValid = key.isEmpty || key.count >= 8
        let hasKey = !key.isEmpty || provider.configured || !provider.requiresKey
        let customComplete = provider.id != .custom
            || (!baseUrl.trimmingCharacters(in: .whitespaces).isEmpty && !model.trimmingCharacters(in: .whitespaces).isEmpty)
        return !saving && keyValid && hasKey && customComplete
    }

    /// Local fields follow the selected provider (the web keys its panel by provider id).
    private func seed() {
        apiKey = ""
        model = active?.model ?? ""
        baseUrl = active?.baseUrl ?? ""
        status = nil
        error = nil
    }

    private func select(_ id: LLMProviderID) async {
        saving = true
        error = nil
        defer { saving = false }
        do {
            try await auth.selectLlmProvider(id)
        } catch {
            self.error = error.userMessage(fallback: "Could not change provider")
        }
    }

    private func save(_ provider: LLMProviderState) async {
        let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        status = nil
        error = nil
        if !key.isEmpty, key.count < 8 {
            error = "That doesn't look like a valid API key"
            return
        }
        let hadKey = provider.configured
        saving = true
        defer { saving = false }
        do {
            try await auth.saveLlmCredential(
                provider.id,
                apiKey: key.isEmpty ? nil : key,
                model: model.trimmingCharacters(in: .whitespaces),
                baseUrl: provider.id == .custom ? baseUrl.trimmingCharacters(in: .whitespaces) : nil
            )
            apiKey = ""
            status = key.isEmpty ? "Settings saved" : (hadKey ? "API key replaced" : "API key saved")
        } catch {
            self.error = error.userMessage(fallback: "Could not save settings")
        }
    }

    private func remove(_ provider: LLMProviderState) async {
        status = nil
        error = nil
        saving = true
        defer { saving = false }
        do {
            try await auth.removeLlmCredential(provider.id)
            apiKey = ""
            model = ""
            baseUrl = ""
            status = "API key removed"
        } catch {
            self.error = error.userMessage(fallback: "Could not remove API key")
        }
    }
}

/// The per-device switch for Apple Foundation Models. Disabled, with the reason, when the
/// device can't run them; summaries made here are uploaded so every client sees them.
struct OnDeviceSection: View {
    @Environment(SummarizationPreferences.self) private var preferences
    @Environment(SummarizationService.self) private var summarizer

    var body: some View {
        @Bindable var preferences = preferences
        Section {
            Toggle("Summarize with Apple Intelligence", isOn: $preferences.onDevice)
                .disabled(summarizer.onDeviceAvailability != .available)
        } header: {
            KickerText("On this device")
        } footer: {
            Text(footer)
        }
    }

    private var footer: String {
        var text = "Summaries made here are uploaded to your account so they also appear on the web and your other devices. Your cloud provider is still used from the web."
        if case .unavailable(let reason) = summarizer.onDeviceAvailability {
            text = reason + " " + text
        }
        return text
    }
}

struct PasswordSection: View {
    @Environment(AuthStore.self) private var auth

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var saving = false
    @State private var status: String?
    @State private var error: String?

    private var hasPassword: Bool { auth.hasPassword }

    var body: some View {
        Section {
            if hasPassword {
                SecureField("Current password", text: $currentPassword)
                    .textContentType(.password)
            }
            SecureField("New password", text: $newPassword)
                .textContentType(.newPassword)
            SecureField("Confirm new password", text: $confirmPassword)
                .textContentType(.newPassword)
            if let status {
                StatusText(message: status)
            }
            if let error {
                ErrorBanner(message: error)
            }
            Button(saving ? "Saving…" : (hasPassword ? "Update password" : "Set password")) {
                Task { await submit() }
            }
            .disabled(saving || newPassword.isEmpty || confirmPassword.isEmpty || (hasPassword && currentPassword.isEmpty))
        } header: {
            KickerText(hasPassword ? "Change password" : "Set a password")
        } footer: {
            Text(hasPassword
                 ? "Update the password used to sign in with email. Other sessions will be signed out. At least 8 characters."
                 : "Add a password so you can sign in with email, alongside your current method. At least 8 characters.")
        }
    }

    private func submit() async {
        status = nil
        error = nil
        guard newPassword.count >= 8 else {
            error = "New password must be at least 8 characters"
            return
        }
        guard newPassword == confirmPassword else {
            error = "New passwords do not match"
            return
        }
        let had = hasPassword
        saving = true
        defer { saving = false }
        do {
            try await auth.changePassword(newPassword: newPassword, currentPassword: had ? currentPassword : nil)
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
            status = had ? "Password updated" : "Password set"
        } catch {
            self.error = error.userMessage(fallback: "Could not update password")
        }
    }
}

struct DiagnosticsSection: View {
    @Environment(AppEnvironment.self) private var environment

    @State private var failures: [FailedEntry]?
    @State private var loading = false
    @State private var retrying: String?
    @State private var error: String?

    var body: some View {
        Section {
            if loading, failures == nil {
                ProgressView().tint(.vermilion)
            }
            if let failures {
                if failures.isEmpty {
                    Text("All clear — nothing failed recently.")
                        .font(.bodySerif.italic())
                        .foregroundStyle(Color.muted)
                }
                ForEach(failures) { failure in
                    row(failure)
                }
            }
            if let error {
                ErrorBanner(message: error)
            }
        } header: {
            HStack {
                KickerText("Diagnostics · Recent processing failures")
                Spacer()
                Button(loading ? "Loading…" : "Refresh") { Task { await load() } }
                    .font(.chip)
                    .disabled(loading)
            }
        } footer: {
            Text("Entries the summarizer couldn't fetch or summarize. Common causes: hard paywalls, blocked archives, transient network errors.")
        }
        .task { await load() }
    }

    private func row(_ failure: FailedEntry) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(failure.title).font(.headlineSerif).foregroundStyle(Color.ink)
                Spacer()
                Text(failure.sourceTitle).font(.chip).foregroundStyle(Color.muted)
            }
            if let url = URL(string: failure.url) {
                Link(failure.url, destination: url)
                    .font(.chip)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            if let message = failure.error {
                Text(message)
                    .font(.chip)
                    .foregroundStyle(Color.vermilionDeep)
                    .lineLimit(3)
            }
            Button(retrying == failure.id ? "Retrying…" : "Retry") { Task { await retry(failure.id) } }
                .font(.chip)
                .disabled(retrying != nil)
        }
        .padding(.vertical, 4)
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            failures = try await environment.api.failures()
        } catch {
            environment.auth.noteError(error)
            self.error = error.userMessage(fallback: "Could not load failures")
        }
    }

    private func retry(_ id: String) async {
        retrying = id
        error = nil
        defer { retrying = nil }
        do {
            try await environment.api.retryEntry(id: id)
            failures?.removeAll { $0.id == id }
        } catch {
            self.error = error.userMessage(fallback: "Retry failed")
        }
    }
}
