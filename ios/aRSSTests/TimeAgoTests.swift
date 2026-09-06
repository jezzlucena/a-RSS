import Foundation
import Testing
@testable import aRSS

@Suite("TimeAgo")
struct TimeAgoTests {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private let locale = Locale(identifier: "en_US")

    private func ago(_ seconds: Double) -> String {
        TimeAgo.string(from: now.addingTimeInterval(-seconds), relativeTo: now, locale: locale)
    }

    @Test func walksTheUnitLadderLikeTheWeb() {
        #expect(ago(0) == "now")
        #expect(ago(30) == "30 seconds ago")
        #expect(ago(5 * 60) == "5 minutes ago")
        #expect(ago(3 * 3600) == "3 hours ago")
        #expect(ago(86_400) == "yesterday")
        #expect(ago(6 * 86_400) == "6 days ago")
        #expect(ago(3 * 7 * 86_400) == "3 weeks ago")
        #expect(ago(5 * 30.44 * 86_400) == "5 months ago")
        #expect(ago(2 * 365.25 * 86_400) == "2 years ago")
    }

    @Test func futureDatesReadForward() {
        #expect(TimeAgo.string(from: now.addingTimeInterval(2 * 3600), relativeTo: now, locale: locale) == "in 2 hours")
    }
}
