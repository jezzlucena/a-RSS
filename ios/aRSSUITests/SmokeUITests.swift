import XCTest

/// Drives the real app against a running API: sign in, expand a card, visit every tab, and
/// keep a screenshot of each step. Skips unless SMOKE_EMAIL / SMOKE_PASSWORD are provided
/// (pass them as TEST_RUNNER_SMOKE_EMAIL / TEST_RUNNER_SMOKE_PASSWORD to xcodebuild).
final class SmokeUITests: XCTestCase {
    @MainActor
    func testSignInAndBrowse() throws {
        let environment = ProcessInfo.processInfo.environment
        guard let email = environment["SMOKE_EMAIL"], let password = environment["SMOKE_PASSWORD"] else {
            throw XCTSkip("SMOKE_EMAIL / SMOKE_PASSWORD not set")
        }

        let app = XCUIApplication()
        app.launch()

        // A previous run leaves the refresh cookie behind, so the app may restore the session
        // and skip the login screen entirely — that's the behavior under test too.
        let emailField = app.textFields["login.email"]
        let masthead = app.staticTexts["All Sources"]
        let deadline = Date().addingTimeInterval(20)
        while !emailField.exists, !masthead.exists, Date() < deadline { usleep(250_000) }

        if emailField.exists {
            snapshot("01-login")
            emailField.tap()
            emailField.typeText(email)
            let passwordField = app.secureTextFields["login.password"]
            passwordField.tap()
            passwordField.typeText(password)
            app.buttons["login.submit"].tap()

            dismissSavePasswordSheet(timeout: 8)
        } else {
            snapshot("01-restored-session")
        }

        XCTAssertTrue(masthead.waitForExistence(timeout: 20), "feed masthead after sign-in")
        sleep(4) // let the first page and images land
        dismissSavePasswordSheet(timeout: 3)
        snapshot("02-feed")

        let firstTitle = app.descendants(matching: .any).matching(identifier: "entry.title").firstMatch
        if firstTitle.waitForExistence(timeout: 10) {
            dismissSavePasswordSheet(timeout: 1)
            firstTitle.tap()
            sleep(5) // summarize / fallback body
            snapshot("03-feed-expanded")
        }

        let tabBar = app.tabBars.firstMatch
        guard tabBar.waitForExistence(timeout: 5) else {
            // Regular width (iPad): a split view with the sidebar instead of tabs.
            XCTAssertTrue(app.staticTexts["All sources"].waitForExistence(timeout: 5), "sidebar")
            snapshot("04-split-view")
            return
        }
        tabBar.buttons["Sources"].tap()
        sleep(2)
        snapshot("04-sources")
        tabBar.buttons["Categories"].tap()
        sleep(2)
        snapshot("05-categories")
        tabBar.buttons["Settings"].tap()
        sleep(2)
        snapshot("06-settings")
        tabBar.buttons["Feed"].tap()
        sleep(2)
        snapshot("07-feed-return")
    }

    /// iOS may offer to save the password after a sign-in; that sheet belongs to SpringBoard,
    /// not the app, and its timing varies.
    private func dismissSavePasswordSheet(timeout: TimeInterval) {
        let notNow = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Not Now"]
        if notNow.waitForExistence(timeout: timeout) { notNow.tap() }
    }

    private func snapshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

extension SmokeUITests {
    /// Scrolls the feed a few screens and keeps a screenshot of each — for eyeballing card layout.
    @MainActor
    func testScrollFeedLayout() throws {
        let environment = ProcessInfo.processInfo.environment
        guard environment["SMOKE_EMAIL"] != nil else { throw XCTSkip("SMOKE_EMAIL not set") }
        let app = XCUIApplication()
        app.launch()
        let masthead = app.staticTexts["All Sources"]
        guard masthead.waitForExistence(timeout: 20) else { throw XCTSkip("not signed in") }
        sleep(4)
        for step in 1...4 {
            app.swipeUp()
            sleep(2)
            let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            attachment.name = "scroll-\(step)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }
}
