import SwiftUI

struct ColorDot: View {
    let hex: String?
    var size: CGFloat = 10

    var body: some View {
        Circle()
            .fill(hex.flatMap { Color(hex: $0) } ?? Color.uncategorizedDot)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// The web's `EmptyState`: kicker, serif headline, muted body.
struct EmptyState: View {
    let kicker: String
    let title: String
    let body_: String

    init(kicker: String, title: String, body: String) {
        self.kicker = kicker
        self.title = title
        self.body_ = body
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            KickerText(kicker)
            Text(title).font(.titleSerif).foregroundStyle(Color.ink)
            Text(body_).font(.bodySerif).foregroundStyle(Color.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 40)
    }
}
