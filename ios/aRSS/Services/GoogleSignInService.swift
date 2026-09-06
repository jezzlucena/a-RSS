import GoogleSignIn
import UIKit

enum GoogleSignInError: Error {
    case noPresenter
    case missingIDToken
}

/// Thin wrapper over GoogleSignIn-iOS. Only the ID-token *string* leaves this file — the SDK's
/// result types aren't Sendable, so everything stays on the main actor.
enum GoogleSignInService {
    /// The SDK reads `GIDClientID` from Info.plist; with an empty id it would crash on use.
    static var isConfigured: Bool { !AppConfig.googleClientID.isEmpty }

    /// Returns the Google ID token, or nil when the user cancelled.
    static func signIn() async throws -> String? {
        guard let presenter = topViewController() else { throw GoogleSignInError.noPresenter }
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            guard let token = result.user.idToken?.tokenString else { throw GoogleSignInError.missingIDToken }
            return token
        } catch let error as GIDSignInError where error.code == .canceled {
            return nil
        }
    }

    @discardableResult
    static func handle(_ url: URL) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? scenes.first?.keyWindow
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
