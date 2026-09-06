import SwiftUI

/// Inline error, the web's `role="alert"` paragraph: a vermilion left rule and the message.
struct ErrorBanner: View {
    /// A secondary affordance next to (or instead of) "Try again", e.g. "Open Settings".
    struct Action {
        let label: String
        let perform: () -> Void
    }

    let message: String
    var retry: (() -> Void)?
    var action: Action?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Rectangle().fill(Color.vermilion).frame(width: 2)
            VStack(alignment: .leading, spacing: 6) {
                Text(message)
                    .font(.callout)
                    .foregroundStyle(Color.vermilionDeep)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 16) {
                    if let retry {
                        Button("Try again", systemImage: "arrow.clockwise", action: retry)
                    }
                    if let action {
                        Button(action.label, systemImage: "arrow.right", action: action.perform)
                    }
                }
                .font(.chip)
                .buttonStyle(.plain)
                .foregroundStyle(Color.vermilion)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}

/// Inline status line, the web's `role="status"` text.
struct StatusText: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.callout)
            .foregroundStyle(Color.muted)
            .fixedSize(horizontal: false, vertical: true)
    }
}
