import Foundation

/// Per-device choice to summarize with Apple Foundation Models instead of the account's cloud
/// provider. Device-local on purpose: the web and other devices keep using the cloud provider.
@Observable
final class SummarizationPreferences {
    static let storageKey = "arss-summarize-on-device"

    var onDevice: Bool {
        didSet { defaults.set(onDevice, forKey: Self.storageKey) }
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        onDevice = defaults.bool(forKey: Self.storageKey)
    }
}
