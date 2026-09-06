import Foundation

/// Transient, non-blocking error notices — the iOS stand-in for react-toastify. The web only
/// ever shows error toasts (no success toasts), and only for background/optimistic failures.
@Observable
final class ToastCenter {
    struct Toast: Identifiable, Equatable {
        enum Style { case error, info }
        let id = UUID()
        let message: String
        let style: Style
    }

    private(set) var current: Toast?
    private var dismissTask: Task<Void, Never>?

    func error(_ message: String) { show(Toast(message: message, style: .error)) }
    func info(_ message: String) { show(Toast(message: message, style: .info)) }

    /// Shows the server's `message` when there is one, else the call site's fallback — the
    /// same `err.message ?? fallback` rule every web toast follows.
    func report(_ error: any Error, fallback: String) {
        self.error(error.userMessage(fallback: fallback))
    }

    func dismiss() {
        dismissTask?.cancel()
        current = nil
    }

    private func show(_ toast: Toast) {
        dismissTask?.cancel()
        current = toast
        dismissTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled, let self, self.current?.id == toast.id else { return }
            self.current = nil
        }
    }
}
