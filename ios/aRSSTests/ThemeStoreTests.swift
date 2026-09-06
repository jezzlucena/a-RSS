import Foundation
import SwiftUI
import Testing
@testable import aRSS

@Suite("ThemeStore")
struct ThemeStoreTests {
    private func makeDefaults() -> UserDefaults {
        let suite = "ThemeStoreTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

    @Test func defaultsToSystemAndPersistsUnderTheWebKey() {
        let defaults = makeDefaults()
        let store = ThemeStore(defaults: defaults)
        #expect(store.preference == .system)
        #expect(store.colorScheme == nil)

        store.preference = .dark
        #expect(defaults.string(forKey: "arss-theme") == "dark")
        #expect(ThemeStore(defaults: defaults).preference == .dark)
    }

    @Test func garbageInStorageFallsBackToSystem() {
        let defaults = makeDefaults()
        defaults.set("sepia", forKey: "arss-theme")
        #expect(ThemeStore(defaults: defaults).preference == .system)
    }

    @Test func toggleFlipsToTheExplicitOppositeOfTheResolvedScheme() {
        let store = ThemeStore(defaults: makeDefaults())
        store.toggle(resolved: .dark)
        #expect(store.preference == .light)
        store.toggle(resolved: .light)
        #expect(store.preference == .dark)
    }
}
