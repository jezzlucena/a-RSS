import SwiftUI

extension Color {
    /// Parses `#RRGGBB` (the only form the API accepts for category colors).
    init?(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
        self.init(
            .sRGB,
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }

    /// `#RRGGBB` for sending a picked color back to the API.
    func hexString(in environment: EnvironmentValues = EnvironmentValues()) -> String? {
        guard let components = resolve(in: environment).cgColor.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components,
              components.count >= 3 else { return nil }
        let channel = { (c: CGFloat) -> Int in Int((max(0, min(1, c)) * 255).rounded()) }
        return String(format: "#%02X%02X%02X", channel(components[0]), channel(components[1]), channel(components[2]))
    }
}
