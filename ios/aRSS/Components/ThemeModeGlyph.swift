import SwiftUI

/// The appearance button's glyph for the *current* preference: a sun for Light, a moon for
/// Dark, and for System a sun and a moon separated by a diagonal bar.
struct ThemeModeGlyph: View {
    let preference: ThemePreference

    var body: some View {
        switch preference {
        case .light:
            Image(systemName: "sun.max")
        case .dark:
            Image(systemName: "moon")
        case .system:
            HStack(spacing: 1) {
                Image(systemName: "sun.max")
                    .font(.system(size: 10, weight: .semibold))
                Rectangle()
                    .frame(width: 1.5, height: 16)
                    .rotationEffect(.degrees(22))
                Image(systemName: "moon")
                    .font(.system(size: 10, weight: .semibold))
            }
            .frame(width: 28, height: 22)
        }
    }

    static func label(for preference: ThemePreference) -> String {
        switch preference {
        case .light: "Light"
        case .dark: "Dark"
        case .system: "System (auto)"
        }
    }
}

#if canImport(UIKit)
import UIKit

extension ThemeModeGlyph {
    /// A template image of the glyph, for UIKit bar buttons (the Mac title-bar toolbar).
    @MainActor
    static func uiImage(for preference: ThemePreference, scale: CGFloat) -> UIImage? {
        switch preference {
        case .light: return UIImage(systemName: "sun.max")
        case .dark: return UIImage(systemName: "moon")
        case .system:
            let renderer = ImageRenderer(content: ThemeModeGlyph(preference: .system).foregroundStyle(.black))
            renderer.scale = scale
            return renderer.uiImage?.withRenderingMode(.alwaysTemplate)
        }
    }
}
#endif
