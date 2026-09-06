import SwiftUI

/// Renders `ToastCenter.current` as a floating Liquid Glass capsule at the top of the screen.
struct ToastOverlay: View {
    @Environment(ToastCenter.self) private var toasts

    var body: some View {
        VStack {
            if let toast = toasts.current {
                GlassEffectContainer {
                    Button {
                        toasts.dismiss()
                    } label: {
                        Label(toast.message, systemImage: toast.style == .error ? "exclamationmark.triangle.fill" : "info.circle.fill")
                            .font(.callout)
                            .foregroundStyle(Color.ink)
                            .multilineTextAlignment(.leading)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                    .glassEffect(.regular.tint(toast.style == .error ? Color.vermilion.opacity(0.35) : nil).interactive())
                }
                .padding(.horizontal, 16)
                .transition(.move(edge: .top).combined(with: .opacity))
                .accessibilityAddTraits(.isStaticText)
            }
        }
        .padding(.top, 8)
        .animation(.snappy, value: toasts.current)
    }
}
