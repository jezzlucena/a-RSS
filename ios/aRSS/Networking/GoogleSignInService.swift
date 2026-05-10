import Foundation
import UIKit
import GoogleSignIn

@MainActor
enum GoogleSignInService {
    static var clientID: String? {
        let value = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String
        return (value?.isEmpty == false) ? value : nil
    }

    static var isConfigured: Bool { clientID != nil }

    /// Returns the Google ID token, or nil if the user cancelled.
    static func signIn() async throws -> String? {
        guard let clientID else {
            throw GoogleSignInError.notConfigured
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)

        guard let presentingVC = topViewController() else {
            throw GoogleSignInError.noPresenter
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingVC)
            guard let idToken = result.user.idToken?.tokenString else {
                throw GoogleSignInError.missingIDToken
            }
            return idToken
        } catch let error as NSError where error.code == GIDSignInError.canceled.rawValue {
            return nil
        }
    }

    /// Forward an inbound URL to GIDSignIn. Returns true if Google handled it.
    static func handle(url: URL) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }

    private static func topViewController() -> UIViewController? {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive })
            ?? UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first
        else { return nil }
        var top = scene.windows.first(where: \.isKeyWindow)?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

enum GoogleSignInError: LocalizedError {
    case notConfigured
    case noPresenter
    case missingIDToken

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Google sign-in is not configured. Set GOOGLE_CLIENT_ID + GOOGLE_REVERSED_CLIENT_ID in your build settings."
        case .noPresenter: return "No window available to present sign-in."
        case .missingIDToken: return "Google did not return an ID token."
        }
    }
}
