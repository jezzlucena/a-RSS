import AVFoundation
import MediaPlayer
import NaturalLanguage
import Observation
import UIKit

/// Shared by the phone and CarPlay; text is resolved lazily so Stop also cancels preparation.
protocol SpeechPlaying: AnyObject {
    var speakingID: String? { get }
    func play(id: String, title: String, text: @escaping () async throws -> String,
              onFinish: (() -> Void)?, next: (() -> Void)?, previous: (() -> Void)?)
    func stop()
}

@Observable
final class SpeechReader: SpeechPlaying {
    private(set) var speakingID: String?
    private(set) var failureID: UUID?
    private(set) var isPaused = false
    private(set) var isLoading = false
    private let api: any ARSSAPI
    private let auth: AuthStore
    private let toasts: ToastCenter
    // Lazy: store and script unit tests never initialize the speech engine.
    @ObservationIgnored private lazy var synthesizer: AVSpeechSynthesizer = {
        let synth = AVSpeechSynthesizer()
        synth.delegate = delegate
        return synth
    }()
    private let delegate = Delegate()
    private var player: AVAudioPlayer?
    private var utteranceID: ObjectIdentifier?
    private var pendingUtterance: AVSpeechUtterance?
    private var audioID: ObjectIdentifier?
    private var task: Task<Void, Never>?
    private var generation = UUID()
    private var chunks: [String] = []
    private var title = ""
    private var completion: (() -> Void)?
    private var next: (() -> Void)?
    private var previous: (() -> Void)?
    private var remoteTargets: [(MPRemoteCommand, Any)] = []
    private var observers: [NSObjectProtocol] = []
    private var resumeAfterInterruption = false
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    init(api: any ARSSAPI, auth: AuthStore, toasts: ToastCenter) {
        self.api = api; self.auth = auth; self.toasts = toasts
        delegate.onSpeechFinish = { [weak self] id in
            guard let self, self.utteranceID == id else { return }
            self.finish()
        }
        delegate.onSpeechCancel = { [weak self] id in
            guard let self, self.utteranceID == id else { return }
            self.stop()
        }
        delegate.onAudioFinish = { [weak self] id, success in
            guard let self, self.audioID == id else { return }
            if success { self.playNextChunk(token: self.generation) }
            else { self.fail(APIError.http(status: 422, code: "speech_invalid_audio", message: "Could not decode ElevenLabs audio", retryable: true), token: self.generation) }
        }
    }

    func isSpeaking(_ id: String) -> Bool { speakingID == id }

    func toggle(id: String, title: String, text: String) {
        if speakingID == id { stop(); return }
        play(id: id, title: title, text: { text }, onFinish: nil, next: nil, previous: nil)
    }

    func play(id: String, title: String, text: @escaping () async throws -> String,
              onFinish: (() -> Void)? = nil, next: (() -> Void)? = nil, previous: (() -> Void)? = nil) {
        stop()
        speakingID = id
        failureID = nil
        beginPreparation()
        self.title = title
        completion = onFinish; self.next = next; self.previous = previous
        isLoading = true
        let token = generation
        configureControls()
        updateNowPlaying()
        task = Task { [weak self] in
            guard let self else { return }
            do {
                let script = try await text()
                guard token == generation, !Task.isCancelled else { return }
                guard !script.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { finish(); return }
                if auth.me?.speech?.provider == .elevenlabs {
                    chunks = ReadAloudScript.chunks(script)
                    playNextChunk(token: token)
                } else {
                    try activateSession()
                    let utterance = AVSpeechUtterance(string: script)
                    utterance.voice = Self.voice(for: script)
                    utteranceID = ObjectIdentifier(utterance)
                    isLoading = false
                    if isPaused { pendingUtterance = utterance }
                    else { synthesizer.speak(utterance) }
                    endPreparation()
                    updateNowPlaying()
                }
            } catch { fail(error, token: token) }
        }
    }

    private func playNextChunk(token: UUID) {
        guard token == generation else { return }
        audioID = nil; player = nil
        guard !chunks.isEmpty else { finish(); return }
        isLoading = true
        updateNowPlaying()
        beginPreparation()
        let text = chunks.removeFirst()
        task = Task { [weak self] in
            guard let self else { return }
            do {
                let data = try await api.createSpeech(text: text)
                guard token == generation, !Task.isCancelled else { return }
                try activateSession()
                let audio = try AVAudioPlayer(data: data)
                audio.delegate = delegate
                player = audio
                audioID = ObjectIdentifier(audio)
                isLoading = false
                endPreparation()
                if !isPaused, !audio.play() { throw APIError.http(status: 422, code: "speech_invalid_audio", message: "Could not play ElevenLabs audio", retryable: true) }
                updateNowPlaying()
            } catch { fail(error, token: token) }
        }
    }

    func pause() {
        guard speakingID != nil, !isPaused else { return }
        isPaused = true
        if utteranceID != nil { synthesizer.pauseSpeaking(at: .immediate) }
        player?.pause()
        updateNowPlaying()
    }

    func resume() {
        guard speakingID != nil, isPaused else { return }
        do {
            try activateSession()
            isPaused = false
            if let pendingUtterance {
                self.pendingUtterance = nil
                synthesizer.speak(pendingUtterance)
            } else if utteranceID != nil { synthesizer.continueSpeaking() }
            if let player, !player.play() { throw APIError.http(status: 422, code: "speech_invalid_audio", message: "Could not resume audio", retryable: true) }
            updateNowPlaying()
        } catch { fail(error, token: generation) }
    }

    func stop() {
        generation = UUID()
        task?.cancel(); task = nil
        endPreparation()
        let hadUtterance = utteranceID != nil
        utteranceID = nil; pendingUtterance = nil; audioID = nil
        if hadUtterance { synthesizer.stopSpeaking(at: .immediate) }
        player?.stop(); player = nil
        chunks = []; completion = nil; next = nil; previous = nil
        let wasActive = speakingID != nil
        speakingID = nil; isPaused = false; isLoading = false
        for (command, target) in remoteTargets { command.removeTarget(target) }
        remoteTargets = []
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        observers = []
        if wasActive {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            let commands = MPRemoteCommandCenter.shared()
            commands.playCommand.isEnabled = false; commands.pauseCommand.isEnabled = false
            commands.togglePlayPauseCommand.isEnabled = false; commands.stopCommand.isEnabled = false
            commands.nextTrackCommand.isEnabled = false; commands.previousTrackCommand.isEnabled = false
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func finish() {
        let callback = completion
        stop()
        callback?()
    }

    private func fail(_ error: any Error, token: UUID) {
        guard token == generation else { return }
        stop()
        failureID = UUID()
        auth.noteError(error)
        toasts.report(error, fallback: "Could not read this aloud")
    }

    // Audio generation can finish while the phone is locked; give pending work the system's
    // bounded background time instead of relying on a silent audio session to keep it alive.
    private func beginPreparation() {
        guard backgroundTask == .invalid else { return }
        let token = generation
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "Prepare read aloud") { [weak self] in
            Task { @MainActor [weak self] in
                guard let self, generation == token else { return }
                stop()
            }
        }
    }

    private func endPreparation() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    private func activateSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio, options: [])
        try session.setActive(true)
    }

    private func updateNowPlaying() {
        // Only the title is readable in the car. Never put summary/body text in metadata.
        var info: [String: Any] = [MPMediaItemPropertyTitle: title,
                                  MPNowPlayingInfoPropertyPlaybackRate: isPaused || isLoading ? 0.0 : 1.0]
        if let player {
            info[MPMediaItemPropertyPlaybackDuration] = player.duration
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func configureControls() {
        let token = generation
        let commands = MPRemoteCommandCenter.shared()
        bind(commands.playCommand) { $0.resume() }
        bind(commands.pauseCommand) { $0.pause() }
        bind(commands.togglePlayPauseCommand) { $0.isPaused ? $0.resume() : $0.pause() }
        bind(commands.stopCommand) { $0.stop() }
        commands.nextTrackCommand.isEnabled = next != nil
        commands.previousTrackCommand.isEnabled = previous != nil
        if next != nil { bind(commands.nextTrackCommand) { $0.next?() } }
        if previous != nil { bind(commands.previousTrackCommand) { $0.previous?() } }
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let type = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let options = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            Task { @MainActor [weak self] in
                guard let self, generation == token else { return }
                if type == AVAudioSession.InterruptionType.began.rawValue {
                    resumeAfterInterruption = !isPaused
                    pause()
                } else if resumeAfterInterruption && AVAudioSession.InterruptionOptions(rawValue: options).contains(.shouldResume) {
                    resumeAfterInterruption = false
                    resume()
                }
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
            let reason = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            if reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue {
                Task { @MainActor [weak self] in
                    guard let self, generation == token else { return }
                    pause()
                }
            }
        })
    }

    private func bind(_ command: MPRemoteCommand, action: @escaping @MainActor @Sendable (SpeechReader) -> Void) {
        command.isEnabled = true
        let token = generation
        let target = command.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in if let self, generation == token { action(self) } }
            return .success
        }
        remoteTargets.append((command, target))
    }

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

    @MainActor private final class Delegate: NSObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
        var onSpeechFinish: ((ObjectIdentifier) -> Void)?
        var onSpeechCancel: ((ObjectIdentifier) -> Void)?
        var onAudioFinish: ((ObjectIdentifier, Bool) -> Void)?

        nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
            let id = ObjectIdentifier(utterance)
            Task { @MainActor [weak self] in self?.onSpeechFinish?(id) }
        }
        nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
            let id = ObjectIdentifier(utterance)
            Task { @MainActor [weak self] in self?.onSpeechCancel?(id) }
        }
        // Cancelling an old utterance must never complete the replacement read.
        nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
            let id = ObjectIdentifier(player)
            Task { @MainActor [weak self] in self?.onAudioFinish?(id, flag) }
        }
        nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: (any Error)?) {
            let id = ObjectIdentifier(player)
            Task { @MainActor [weak self] in self?.onAudioFinish?(id, false) }
        }
    }
}

/// What gets read for an entry: the summary (title, intro, bullets) or the full article. Pure,
/// so the unit tests cover it without touching the synthesizer.
enum ReadAloudScript {
    /// Count UTF-16 units like the shared Zod limit, even for emoji and unbroken text.
    static func chunks(_ text: String, limit: Int = 4_000) -> [String] {
        var result: [String] = []
        var current = ""
        var units = 0
        for scalar in text.unicodeScalars {
            let part = String(scalar)
            let width = part.utf16.count
            if units + width > limit {
                if let space = current.lastIndex(of: " "), current.distance(from: current.startIndex, to: space) > current.count / 2 {
                    result.append(String(current[..<space]))
                    current = String(current[current.index(after: space)...])
                } else {
                    result.append(current)
                    current = ""
                }
                units = current.utf16.count
            }
            current.append(part)
            units += width
        }
        if !current.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { result.append(current) }
        return result
    }

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
