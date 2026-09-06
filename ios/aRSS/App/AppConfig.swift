import Foundation

/// Build-time configuration piped through Info.plist by project.yml (see `ARSS_API_BASE_URL`,
/// `GOOGLE_CLIENT_ID` there and in Local.xcconfig.example).
enum AppConfig {
    static var apiBaseURL: URL {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "ARSS_API_BASE_URL") as? String) ?? ""
        return URL(string: raw.isEmpty ? "https://api.a-rss.com/api/v1" : raw) ?? URL(string: "https://api.a-rss.com/api/v1")!
    }

    static var googleClientID: String {
        (Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String) ?? ""
    }

    static var version: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "0.0.0"
    }
}
