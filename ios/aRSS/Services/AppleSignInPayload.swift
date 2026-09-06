import AuthenticationServices

enum AppleSignInError: Error {
    case notAnAppleIDCredential
    case missingIdentityToken
}

/// Maps a completed Sign in with Apple authorization to the API's `POST /auth/apple` body.
/// Apple only hands over `email`/`fullName` on the first authorization; both are optional.
enum AppleSignInPayload {
    static func request(from authorization: ASAuthorization) throws -> AppleAuthRequest {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            throw AppleSignInError.notAnAppleIDCredential
        }
        guard let data = credential.identityToken, let token = String(data: data, encoding: .utf8) else {
            throw AppleSignInError.missingIdentityToken
        }
        var fullName: AppleFullName?
        if let name = credential.fullName, name.givenName != nil || name.familyName != nil {
            fullName = AppleFullName(givenName: name.givenName, familyName: name.familyName)
        }
        return AppleAuthRequest(identityToken: token, email: credential.email, fullName: fullName)
    }
}
