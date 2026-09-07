import SwiftUI

/// Read aloud / Stop toggle for one entry. Stops its own reading when it leaves the screen
/// (card collapsed, detail dismissed) so speech never outlives what the user is looking at.
struct ReadAloudButton: View {
    let id: String
    let text: String

    @Environment(SpeechReader.self) private var reader

    private var speaking: Bool { reader.isSpeaking(id) }

    var body: some View {
        Button {
            reader.toggle(id: id, text: text)
        } label: {
            // Icon only; the label stays for VoiceOver.
            Label(speaking ? "Stop" : "Read aloud", systemImage: speaking ? "stop.fill" : "speaker.wave.2")
                .labelStyle(.iconOnly)
        }
        .buttonStyle(.glass)
        .controlSize(.small)
        .tint(speaking ? Color.vermilion : nil)
        .accessibilityHint(speaking ? "Stops reading" : "Reads this aloud")
        .onDisappear { if speaking { reader.stop() } }
    }
}
