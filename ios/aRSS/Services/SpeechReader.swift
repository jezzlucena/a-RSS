import AVFoundation
import NaturalLanguage
import Observation

/// Reads a summary or an article aloud with the system voice (`AVSpeechSynthesizer`). One thing
/// speaks at a time: starting a new read stops the previous one, and the view that started it
/// stops it again when it leaves the screen (see `ReadAloudButton`).
@Observable
final class SpeechReader {
    /// The entry currently being read, so its button can show Stop while every other shows Read aloud.
    private(set) var speakingID: String?

    private let synthesizer = AVSpeechSynthesizer()
    private let delegate = Delegate()

    init() {
        synthesizer.delegate = delegate
        delegate.onFinish = { [weak self] in self?.finished() }
    }

    func isSpeaking(_ id: String) -> Bool { speakingID == id }

    /// Starts reading `text` for `id`, or stops if that entry is already being read.
    func toggle(id: String, text: String) {
        if speakingID == id {
            stop()
            return
        }
        stop()
        // Spoken-audio playback keeps reading with the ring switch muted and ducks music instead
        // of pausing it; deactivated again when the utterance ends.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)

        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.voice(for: text)
        speakingID = id
        synthesizer.speak(utterance)
    }

    func stop() {
        guard speakingID != nil else { return }
        speakingID = nil
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
        deactivateSession()
    }

    private func finished() {
        guard speakingID != nil else { return }
        speakingID = nil
        deactivateSession()
    }

    private func deactivateSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// A voice matching the article's language (an English UI shouldn't read Spanish news with an
    /// English voice); nil leaves the system default, which is the device language.
    private static func voice(for text: String) -> AVSpeechSynthesisVoice? {
        guard let code = NLLanguageRecognizer.dominantLanguage(for: text)?.rawValue else { return nil }
        let candidates = AVSpeechSynthesisVoice.speechVoices().filter {
            $0.language == code || $0.language.hasPrefix(code + "-")
        }
        if let preferred = Locale.preferredLanguages.lazy.compactMap({ tag in candidates.first { $0.language == tag } }).first {
            return preferred
        }
        return candidates.max { $0.quality.rawValue < $1.quality.rawValue }
    }

    /// `AVSpeechSynthesizerDelegate` callbacks aren't guaranteed on the main thread, so they hop.
    private final class Delegate: NSObject, AVSpeechSynthesizerDelegate {
        var onFinish: (() -> Void)?

        nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
            Task { @MainActor [weak self] in self?.onFinish?() }
        }

        nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
            Task { @MainActor [weak self] in self?.onFinish?() }
        }
    }
}

/// What gets read for an entry: the summary (title, intro, bullets) or the full article. Pure,
/// so the unit tests cover it without touching the synthesizer.
enum ReadAloudScript {
    static func summary(title: String, intro: String?, bullets: [String]) -> String {
        var parts = [sentence(title)]
        if let intro, !intro.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            parts.append(sentence(intro))
        }
        parts.append(contentsOf: bullets.map(sentence).filter { !$0.isEmpty })
        return parts.joined(separator: "\n")
    }

    static func article(title: String, body: String) -> String {
        [sentence(title), body.trimmingCharacters(in: .whitespacesAndNewlines)]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    /// Trims and ends the fragment with a full stop so the voice pauses between items instead
    /// of running a bullet into the next.
    private static func sentence(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let last = trimmed.last else { return "" }
        return ".!?…:;".contains(last) ? trimmed : trimmed + "."
    }
}
