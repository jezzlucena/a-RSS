import Foundation
import Security

/// Keychain mirror of the `arss_refresh` cookie.
///
/// The server rotates the refresh token on every refresh and marks the old one used, while
/// `HTTPCookieStorage` writes to disk lazily. If the app is killed within a few seconds of a
/// refresh, the on-disk cookie is the *used* one and the next launch gets `invalid_refresh`
/// — observed on the simulator. Saving the cookie here synchronously after each auth response
/// and re-seeding the cookie store from it at launch closes that window.
nonisolated enum RefreshCookieVault {
    static let cookieName = "arss_refresh"
    private static let service = "com.arss.app.refresh-cookie"
    private static let account = "arss_refresh"

    private static var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    static func save(_ cookie: HTTPCookie) {
        guard let properties = cookie.properties else { return }
        let plist = Dictionary(uniqueKeysWithValues: properties.map { ($0.key.rawValue, $0.value) })
        guard let data = try? PropertyListSerialization.data(fromPropertyList: plist, format: .binary, options: 0) else { return }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            SecItemAdd(query.merging(attributes) { $1 } as CFDictionary, nil)
        }
    }

    static func load() -> HTTPCookie? {
        var lookup = query
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(lookup as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        else { return nil }
        let properties = Dictionary(uniqueKeysWithValues: plist.map { (HTTPCookiePropertyKey($0.key), $0.value) })
        return HTTPCookie(properties: properties)
    }

    static func clear() {
        SecItemDelete(query as CFDictionary)
    }
}
