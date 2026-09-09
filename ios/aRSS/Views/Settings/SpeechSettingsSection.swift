import SwiftUI

struct SpeechSettingsSection: View {
    @Environment(AuthStore.self) private var auth
    @Environment(SpeechReader.self) private var reader
    @State private var provider = SpeechProvider.system
    @State private var apiKey = ""
    @State private var voiceId = SpeechSettings.defaults.voiceId
    @State private var modelId = SpeechSettings.defaults.modelId
    @State private var saving = false
    @State private var error: String?
    @State private var status: String?

    private var settings: SpeechSettings { auth.me?.speech ?? .defaults }

    var body: some View {
        Section {
            Picker("Voice provider", selection: $provider) {
                Text("System voice").tag(SpeechProvider.system)
                Text("ElevenLabs").tag(SpeechProvider.elevenlabs)
            }
            if provider == .elevenlabs {
                SecureField(settings.configured ? "Replace API key (optional)" : "ElevenLabs API key", text: $apiKey)
                    .textContentType(.password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Voice ID", text: $voiceId)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Model ID", text: $modelId)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                Link("Find a voice in ElevenLabs", destination: URL(string: "https://elevenlabs.io/app/voice-library")!)
            }
            if let error { ErrorBanner(message: error) }
            if let status { StatusText(message: status) }
            HStack {
                if settings.configured {
                    Button("Remove key", role: .destructive) { Task { await save(clear: true) } }
                        .buttonStyle(.glass)
                }
                Button(saving ? "Saving…" : "Save") { Task { await save() } }
                    .buttonStyle(.glassProminent)
                    .disabled(provider == .elevenlabs && (!settings.configured && apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || voiceId.isEmpty || modelId.isEmpty))
            }
        } header: {
            KickerText("Read aloud")
        } footer: {
            Text("Shared by web, iOS and CarPlay. ElevenLabs receives the text you play and uses your account’s credits. Your key is encrypted on the server. The default voice is George. CarPlay displays article titles and reads summaries only.")
        }
        .disabled(saving)
        .onChange(of: settings, initial: true) { _, value in
            provider = value.provider == .elevenlabs ? .elevenlabs : .system
            voiceId = value.voiceId
            modelId = value.modelId
        }
    }

    private func save(clear: Bool = false) async {
        saving = true; error = nil; status = nil
        defer { saving = false }
        do {
            if clear { try await auth.removeSpeechCredential() }
            else {
                let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
                try await auth.saveSpeechSettings(UpdateSpeechSettingsRequest(
                    provider: provider, apiKey: key.isEmpty ? nil : key,
                    voiceId: voiceId.trimmingCharacters(in: .whitespacesAndNewlines),
                    modelId: modelId.trimmingCharacters(in: .whitespacesAndNewlines)))
            }
            reader.stop()
            apiKey = ""
            status = clear ? "Key removed. Using the system voice." : "Read aloud settings saved."
        } catch {
            auth.noteError(error)
            self.error = error.userMessage(fallback: "Could not save read aloud settings")
        }
    }
}
