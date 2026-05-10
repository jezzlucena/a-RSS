import XCTest
@testable import aRSS

final class DTOTests: XCTestCase {
    func testDecodingFeedResponse() throws {
        let json = """
        {
          "entries": [
            {
              "id": "65fffa1a2c5b9f0001a1b2c3",
              "sourceId": "65fffa1a2c5b9f0001a1b2d4",
              "sourceTitle": "The Verge",
              "categoryId": null,
              "url": "https://www.theverge.com/example",
              "title": "Sample headline",
              "publishedAt": "2026-04-25T18:30:00.000Z",
              "description": "snippet…",
              "summary": {
                "bullets": ["one", "two", "three"],
                "model": "claude-haiku-4-5-20251001",
                "generatedAt": "2026-04-25T18:35:00.000Z"
              },
              "image": { "url": "https://example.com/img.jpg", "source": "og" },
              "processingState": "summarized",
              "isRead": false
            }
          ],
          "nextCursor": "abc",
          "unreadCount": 12
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(FeedResponse.self, from: json)
        XCTAssertEqual(response.entries.count, 1)
        XCTAssertEqual(response.entries[0].summary?.bullets.count, 3)
        XCTAssertEqual(response.unreadCount, 12)
        XCTAssertEqual(response.nextCursor, "abc")
    }

    func testFeedViewApiValue() {
        XCTAssertEqual(FeedView.all.apiValue, "all")
        XCTAssertEqual(FeedView.category("abc").apiValue, "category:abc")
        XCTAssertEqual(FeedView.source("xyz").apiValue, "source:xyz")
    }

    func testBypassStrategyDecoding() throws {
        let payload = """
        ["default","ladder","googlebot","wayback","archive_ph","none"]
        """.data(using: .utf8)!
        let decoded = try JSONDecoder().decode([BypassStrategy].self, from: payload)
        XCTAssertEqual(decoded, [.default, .ladder, .googlebot, .wayback, .archive_ph, .none])
    }
}
