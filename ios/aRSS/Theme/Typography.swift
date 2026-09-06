import SwiftUI

/// System-font equivalents of the web's Fraunces / Geist / JetBrains Mono trio: New York via
/// the serif design for display and body copy, SF for controls, SF Mono for chips.
extension Font {
    static let display = Font.system(.largeTitle, design: .serif, weight: .semibold)
    static let titleSerif = Font.system(.title2, design: .serif, weight: .semibold)
    static let headlineSerif = Font.system(.title3, design: .serif, weight: .semibold)
    static let bodySerif = Font.system(.body, design: .serif)
    static let introSerif = Font.system(.title3, design: .serif).italic()
    static let chip = Font.system(.caption, design: .monospaced)
    static let kicker = Font.system(.caption2, design: .monospaced, weight: .medium)
}

/// The small uppercase mono label the web calls `text-chip` — used for kickers and metadata.
struct KickerText: View {
    let text: String
    var color: Color = .muted

    init(_ text: String, color: Color = .muted) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text)
            .font(.kicker)
            .kerning(1.2)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}
