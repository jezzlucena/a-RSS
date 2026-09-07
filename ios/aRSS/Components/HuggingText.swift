import SwiftUI
import UIKit

/// Left-aligned, wrapping text whose frame hugs its *widest line* instead of filling the width
/// it was offered — so centering it puts a one-liner dead center, while a wrapped title keeps
/// its lines left-aligned to each other with the whole block centered as a unit.
///
/// The wrap is *balanced* first (CSS `text-wrap: balance`): the text is laid out at the narrowest
/// width that still yields the same number of lines as the full width. Without that step the
/// widest line of any wrapped title is within one word of the full width, so the "centered box"
/// is inset by a few points and reads as plain left-aligned text — which is every title on an
/// iPhone. With it, a two-line title becomes two similar lines in a box visibly narrower than
/// the illustration above it.
///
/// SwiftUI's `Text` always reports the full proposed width once it wraps, so the lines are
/// measured with the same UIKit font and the `Text` is pinned to the resulting width. Selection,
/// taps and hover effects still belong to the `Text` itself.
struct HuggingText: View {
    let text: String
    let uiFont: UIFont
    let color: Color

    @State private var availableWidth: CGFloat = 0

    var body: some View {
        Text(text)
            .font(Font(uiFont))
            .foregroundStyle(color)
            .multilineTextAlignment(.leading)
            .frame(width: hugWidth, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { availableWidth = $0 }
    }

    /// The widest line of the balanced layout at the current width, or nil (natural size)
    /// before measurement.
    private var hugWidth: CGFloat? {
        guard availableWidth > 0 else { return nil }
        let full = measure(at: availableWidth)
        // A one-liner already hugs; otherwise binary-search the narrowest width that keeps the
        // line count (a narrower box only ever adds lines, so the predicate is monotonic).
        var low: CGFloat = 0
        var high = availableWidth
        var best = full
        while high - low > 1 {
            let mid = (low + high) / 2
            let candidate = measure(at: mid)
            if candidate.height <= full.height + 0.5 {
                best = candidate
                high = mid
            } else {
                low = mid
            }
        }
        // +2 keeps the pinned Text from wrapping a hair earlier than the measurement did.
        return min(availableWidth, ceil(best.width) + 2)
    }

    private func measure(at width: CGFloat) -> CGSize {
        (text as NSString).boundingRect(
            with: CGSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: uiFont],
            context: nil
        ).size
    }
}

extension UIFont {
    /// System serif (New York) at a text style, with a weight — the UIKit twin of
    /// `Font.system(_, design: .serif, weight:)`, for measuring what SwiftUI will draw.
    static func serif(_ style: UIFont.TextStyle, weight: UIFont.Weight) -> UIFont {
        let base = UIFontDescriptor.preferredFontDescriptor(withTextStyle: style)
        let descriptor = (base.withDesign(.serif) ?? base)
            .addingAttributes([.traits: [UIFontDescriptor.TraitKey.weight: weight]])
        return UIFont(descriptor: descriptor, size: 0)
    }
}
