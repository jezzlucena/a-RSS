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

    @Test func articleReadsTitleThenBody() {
        let script = ReadAloudScript.article(title: "Title", body: "\n\nBody text here.\n")
        #expect(script == "Title.\n\nBody text here.")
    }
}
