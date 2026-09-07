import SwiftUI

/// The app name as it appears everywhere: the logo tile beside "a—RSS", with the em dash in
/// the theme's vermilion. Both the tile (light/dark logo variants) and the dash color follow
/// the color scheme through the asset catalog.
struct Wordmark: View {
    enum Size { case display, sidebar, toolbar }

    var size: Size = .toolbar
    /// Logo tile only — for slots that can never hold the name.
    var logoOnly = false
    /// When set, the wordmark is a button (the web's wordmark links home to /feed/all).
    var action: (() -> Void)?

    private var font: Font {
        switch size {
        case .display: .display
        case .sidebar: .titleSerif
        case .toolbar: .system(.headline, design: .serif, weight: .semibold)
        }
    }

    private var logoSide: CGFloat {
        switch size {
        case .display: 40
        case .sidebar: 32
        case .toolbar: 24
        }
    }

    private var spacing: CGFloat { size == .toolbar ? 8 : 12 }

    var body: some View {
        if let action {
            Button(action: action) { mark }
                .buttonStyle(.plain)
                .hoverEffect(.highlight)
                .accessibilityLabel("a-RSS — All sources")
        } else {
            mark
        }
    }

    private var mark: some View {
        // The name is all-or-nothing: when the available width can't hold it whole (a narrow
        // sidebar, a crowded toolbar) only the logo tile remains — never a truncated "a—R…".
        Group {
            if logoOnly {
                logo
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .center, spacing: spacing) {
                        logo
                        name.fixedSize()
                    }
                    logo
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("a-RSS")
    }

    private var logo: some View {
        Image("Logo")
            .resizable()
            .interpolation(.high)
            .frame(width: logoSide, height: logoSide)
            .clipShape(RoundedRectangle(cornerRadius: logoSide * 0.2, style: .continuous))
            .accessibilityHidden(true)
    }

    private var name: some View {
        (Text("a") + Text("—").foregroundStyle(Color.vermilion) + Text("RSS"))
            .font(font)
            .foregroundStyle(Color.ink)
            .lineLimit(1)
    }
}
