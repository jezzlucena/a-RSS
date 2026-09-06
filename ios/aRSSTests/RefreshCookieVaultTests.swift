import Foundation
import Testing
@testable import aRSS

@Suite("RefreshCookieVault", .serialized)
struct RefreshCookieVaultTests {
    @Test func roundTripsAndClears() throws {
        RefreshCookieVault.clear()
        #expect(RefreshCookieVault.load() == nil)

        let cookie = try #require(HTTPCookie(properties: [
            .name: RefreshCookieVault.cookieName,
            .value: "opaque-token",
            .domain: "api.a-rss.com",
            .path: "/api/v1/auth",
            .expires: Date().addingTimeInterval(86_400),
        ]))
        RefreshCookieVault.save(cookie)
        let loaded = try #require(RefreshCookieVault.load())
        #expect(loaded.name == RefreshCookieVault.cookieName)
        #expect(loaded.value == "opaque-token")
        #expect(loaded.path == "/api/v1/auth")

        let rotated = try #require(HTTPCookie(properties: [
            .name: RefreshCookieVault.cookieName, .value: "rotated", .domain: "api.a-rss.com", .path: "/api/v1/auth",
        ]))
        RefreshCookieVault.save(rotated)
        #expect(RefreshCookieVault.load()?.value == "rotated", "save overwrites")

        RefreshCookieVault.clear()
        #expect(RefreshCookieVault.load() == nil)
    }
}
