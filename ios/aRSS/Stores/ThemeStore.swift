import SwiftUI

enum ThemePreference: String, CaseIterable, Identifiable {
    case system, light, dark

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

/// Mirrors apps/web/src/stores/theme.ts: a three-way preference persisted under the same key
/// the web uses in localStorage; `system` follows the OS live.
@Observable
final class ThemeStore {
    static let storageKey = "arss-theme"

    var preference: ThemePreference {
        didSet { defaults.set(preference.rawValue, forKey: Self.storageKey) }
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        preference = ThemePreference(rawValue: defaults.string(forKey: Self.storageKey) ?? "") ?? .system
    }

    /// nil lets SwiftUI follow the system appearance.
    var colorScheme: ColorScheme? {
        switch preference {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    /// The navbar toggle flips to the explicit opposite of what's currently *resolved*; it
    /// never lands on `system` (web `theme.toggle`).
    func toggle(resolved: ColorScheme) {
        preference = resolved == .dark ? .light : .dark
    }
}
