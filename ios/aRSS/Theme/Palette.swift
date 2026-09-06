import SwiftUI

/// The web palette (apps/web/src/styles/index.css) as asset-catalog colors with light/dark
/// variants. Everything in the app is drawn with these; system colors are avoided so the
/// "newspaper" look survives theme changes.
extension Color {
    static let paper = Color("Paper")
    static let paperDeep = Color("PaperDeep")
    static let ink = Color("Ink")
    static let muted = Color("Muted")
    static let rule = Color("Rule")
    static let vermilion = Color("Vermilion")
    static let vermilionDeep = Color("VermilionDeep")

    /// The web's fallback for an uncategorized dot (`#6E665A`).
    static let uncategorizedDot = Color(hex: "#6E665A") ?? .muted
}
