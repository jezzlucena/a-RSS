import Foundation
import Testing
@testable import aRSS

@Suite("SummarizationPreferences")
struct SummarizationPreferencesTests {
    @Test func defaultsOffAndPersistsUnderTheDeviceKey() {
        let defaults = Make.isolatedDefaults()
        let preferences = SummarizationPreferences(defaults: defaults)
        #expect(!preferences.onDevice)

        preferences.onDevice = true
        #expect(defaults.bool(forKey: "arss-summarize-on-device"))
        #expect(SummarizationPreferences(defaults: defaults).onDevice)
    }
}
