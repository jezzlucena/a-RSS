import SwiftUI

/// The app name as it appears everywhere: the logo tile beside "a—RSS", with the em dash in
/// the theme's vermilion. Both the tile (light/dark logo variants) and the dash color follow
/// the color scheme through the asset catalog.
struct Wordmark: View {
    enum Size { case display, toolbar }

    var size: Size = .toolbar

    private var font: Font { size == .display ? .display : .system(.headline, design: .serif, weight: .semibold) }
    private var logoSide: CGFloat { size == .display ? 40 : 24 }
    private var spacing: CGFloat { size == .display ? 12 : 8 }

    var body: some View {
        HStack(alignment: .center, spacing: spacing) {
            Image("Logo")
                .resizable()
                .interpolation(.high)
                .frame(width: logoSide, height: logoSide)
                .clipShape(RoundedRectangle(cornerRadius: logoSide * 0.2, style: .continuous))
                .accessibilityHidden(true)
            (Text("a") + Text("—").foregroundStyle(Color.vermilion) + Text("RSS"))
                .font(font)
                .foregroundStyle(Color.ink)
                .lineLimit(1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("a-RSS")
    }
}
