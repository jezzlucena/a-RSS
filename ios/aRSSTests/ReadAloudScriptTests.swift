import Testing
@testable import aRSS

@Suite("ReadAloudScript")
struct ReadAloudScriptTests {
    @Test func summaryReadsTitleIntroAndBulletsAsSentences() {
        let script = ReadAloudScript.summary(
            title: "Rates hold steady",
            intro: " The central bank paused again ",
            bullets: ["First point", "Second point?", ""]
        )
        #expect(script == "Rates hold steady.\nThe central bank paused again.\nFirst point.\nSecond point?")
    }

    @Test func summarySkipsABlankIntro() {
        let script = ReadAloudScript.summary(title: "Title.", intro: "  ", bullets: ["One"])
        #expect(script == "Title.\nOne.")
    }

    @Test func longArticlesAndEmojiRespectTheServerUTF16Limit() {
        for text in [String(repeating: "word ", count: 3000), String(repeating: "x", count: 9001), String(repeating: "😀", count: 4501), "e" + String(repeating: "\u{0301}", count: 9001)] {
            let chunks = ReadAloudScript.chunks(text)
            #expect(chunks.count > 1)
            #expect(chunks.allSatisfy { !$0.isEmpty && $0.utf16.count <= 4000 })
            #expect(chunks.joined().replacingOccurrences(of: " ", with: "") == text.replacingOccurrences(of: " ", with: ""))
        }
    }

    @Test func articleReadsTitleThenBody() {
        let script = ReadAloudScript.article(title: "Title", body: "\n\nBody text here.\n")
        #expect(script == "Title.\n\nBody text here.")
    }
}
