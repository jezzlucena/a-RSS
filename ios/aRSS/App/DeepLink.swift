import Foundation

/// URLs the app can be opened with. The magic-link email points at the web app
/// (`${WEB_BASE_URL}/auth/magic?t=…`), so besides the `arss://auth/magic?t=…` scheme we also
/// accept that web URL when pasted, and anything else is handed to Google Sign-In.
enum DeepLink: Equatable {
    case magic(token: String)
    case other(URL)

    static func parse(_ url: URL) -> DeepLink {
        if let token = magicToken(in: url) { return .magic(token: token) }
        return .other(url)
    }

    static func magicToken(in url: URL) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        // arss://auth/magic → host "auth", path "/magic"; https://host/auth/magic → path "/auth/magic".
        let location = ((components.host ?? "") + components.path).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard location.hasSuffix("auth/magic") else { return nil }
        let token = components.queryItems?.first { $0.name == "t" }?.value?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (token?.isEmpty == false) ? token : nil
    }

    static func magicToken(inPastedText text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed) else { return nil }
        return magicToken(in: url)
    }
}
