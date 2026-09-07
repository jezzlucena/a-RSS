#if targetEnvironment(macCatalyst)
import SwiftUI
import UIKit

/// The Mac window's real toolbar. SwiftUI `.toolbar` items render inside the content area on
/// Catalyst, so the title-bar row — aligned with the close/minimize/zoom buttons — has to be an
/// `NSToolbar` installed on the window scene's `UITitlebar`. Layout, left to right: wordmark,
/// theme and Settings over the sidebar; a sidebar-tracking separator; All/Unread, New/Old,
/// Refresh and Mark read over the content. The feed scope and unread count are the window's
/// title and subtitle. State is mirrored from the stores with observation tracking.
@MainActor
final class MacToolbar: NSObject, NSToolbarDelegate {
    private static var installed: [ObjectIdentifier: MacToolbar] = [:]

    static func install(in scene: UIWindowScene, environment: AppEnvironment) {
        guard installed[ObjectIdentifier(scene)] == nil, let titlebar = scene.titlebar else { return }
        let controller = MacToolbar(scene: scene, environment: environment)
        installed[ObjectIdentifier(scene)] = controller
        titlebar.toolbarStyle = .unified
        titlebar.titleVisibility = .visible
        titlebar.toolbar = controller.toolbar
        controller.observe()
    }

    static func uninstall(from scene: UIWindowScene) {
        guard installed.removeValue(forKey: ObjectIdentifier(scene)) != nil else { return }
        scene.titlebar?.toolbar = nil
        scene.title = ""
        scene.subtitle = ""
    }

    private nonisolated enum ID {
        static let wordmark = NSToolbarItem.Identifier("arss.wordmark")
        static let logo = NSToolbarItem.Identifier("arss.logo")
        static let theme = NSToolbarItem.Identifier("arss.theme")
        static let settings = NSToolbarItem.Identifier("arss.settings")
        static let filter = NSToolbarItem.Identifier("arss.filter")
        static let order = NSToolbarItem.Identifier("arss.order")
        static let refresh = NSToolbarItem.Identifier("arss.refresh")
        static let markRead = NSToolbarItem.Identifier("arss.markRead")
    }

    private let scene: UIWindowScene
    private let environment: AppEnvironment
    private let toolbar: NSToolbar
    /// Hosting controllers for the SwiftUI-backed items, by identifier (replaced on rebuild).
    private var hosts: [NSToolbarItem.Identifier: UIViewController] = [:]
    private var filterGroup: NSToolbarItemGroup?
    private var orderGroup: NSToolbarItemGroup?
    private var showsLogoOnly = false
    /// State the theme and Fetch items were last built for; a change rebuilds the item so it
    /// stays a native bar button (toolbar text color, dimmed when the window is inactive).
    private var themeBuiltPreference: ThemePreference?
    private var fetchBuiltBusy: Bool?
    private var alive = true

    /// Below this sidebar width the full wordmark plus theme and Settings won't fit on one row,
    /// so the name gives way (never the buttons, and never into the » overflow menu).
    private static let fullWordmarkMinSidebarWidth: CGFloat = 320

    private init(scene: UIWindowScene, environment: AppEnvironment) {
        self.scene = scene
        self.environment = environment
        toolbar = NSToolbar(identifier: "arss.main")
        super.init()
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
    }

    // MARK: NSToolbarDelegate

    nonisolated func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        // Theme and Settings hug the wordmark; the wordmark is the flexible item, so a narrow
        // sidebar squeezes it down to the logo before anything falls into the » overflow menu.
        [ID.wordmark, ID.theme, ID.settings, .flexibleSpace, .primarySidebarTrackingSeparatorItemIdentifier,
         ID.filter, ID.order, .flexibleSpace, ID.refresh, ID.markRead]
    }

    nonisolated func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        toolbarDefaultItemIdentifiers(toolbar) + [ID.logo]
    }

    nonisolated func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier identifier: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        MainActor.assumeIsolated { makeItem(identifier) }
    }

    private func makeItem(_ identifier: NSToolbarItem.Identifier) -> NSToolbarItem? {
        switch identifier {
        case ID.wordmark:
            // Swapped for `ID.logo` by `render()` when the sidebar gets too narrow for the name.
            let item = hostedItem(identifier, Wordmark(size: .toolbar, action: { [weak self] in self?.goHome() }).padding(.horizontal, 4), label: "a-RSS")
            item.visibilityPriority = .high
            return item

        case ID.logo:
            // Same footprint as a bar button so it takes its fair share of the glass pill.
            let item = hostedItem(identifier, Wordmark(size: .toolbar, logoOnly: true, action: { [weak self] in self?.goHome() }).frame(width: 28, height: 28), label: "a-RSS")
            item.visibilityPriority = .high
            return item

        case ID.theme:
            let preference = environment.theme.preference
            themeBuiltPreference = preference
            let image = ThemeModeGlyph.uiImage(for: preference, scale: scene.screen.scale)
            let button = UIBarButtonItem(image: image, style: .plain, target: self, action: #selector(cycleTheme))
            let item = NSToolbarItem(itemIdentifier: identifier, barButtonItem: button)
            item.label = "Appearance"
            item.toolTip = "Appearance: \(ThemeModeGlyph.label(for: preference)) — click for \(ThemeModeGlyph.label(for: environment.theme.nextPreference))"
            item.visibilityPriority = .high
            return item

        case ID.settings:
            let button = UIBarButtonItem(image: UIImage(systemName: "gearshape"), style: .plain, target: self, action: #selector(openSettings))
            let item = NSToolbarItem(itemIdentifier: identifier, barButtonItem: button)
            item.label = "Settings"
            item.toolTip = "Show or hide Settings (⌘,)"
            item.visibilityPriority = .high
            return item

        case ID.filter:
            let group = NSToolbarItemGroup(
                itemIdentifier: identifier,
                titles: FeedStore.Filter.allCases.map(\.label),
                selectionMode: .selectOne,
                labels: FeedStore.Filter.allCases.map(\.label),
                target: self,
                action: #selector(filterChanged(_:))
            )
            group.label = "Filter"
            filterGroup = group
            return group

        case ID.order:
            let group = NSToolbarItemGroup(
                itemIdentifier: identifier,
                titles: ["New", "Old"],
                selectionMode: .selectOne,
                labels: ["New", "Old"],
                target: self,
                action: #selector(orderChanged(_:))
            )
            group.label = "Order"
            group.toolTip = "Newest or oldest first"
            orderGroup = group
            return group

        case ID.refresh:
            let busy = environment.feed.polling || environment.feed.loading
            fetchBuiltBusy = busy
            if busy {
                // A spinner stands in for the button while a fetch is in flight.
                let item = hostedItem(identifier, MacFetchSpinner(), label: "Fetch")
                item.toolTip = "Fetching new stories…"
                return item
            }
            let button = UIBarButtonItem(image: UIImage(systemName: "arrow.clockwise"), style: .plain, target: self, action: #selector(fetchNewStories))
            let item = NSToolbarItem(itemIdentifier: identifier, barButtonItem: button)
            item.label = "Fetch"
            item.toolTip = "Fetch new stories (⌘R)"
            return item

        case ID.markRead:
            let item = NSMenuToolbarItem(itemIdentifier: identifier)
            item.image = UIImage(systemName: "checkmark.circle")
            item.label = "Mark read"
            item.toolTip = "Mark entries in this view as read"
            item.showsIndicator = false
            item.itemMenu = UIMenu(title: "Mark read", children: [
                UIAction(title: "All Here") { [weak self] _ in self?.markRead(.all) },
                UIAction(title: "1+ Days") { [weak self] _ in self?.markRead(.olderThan1d) },
                UIAction(title: "7+ Days") { [weak self] _ in self?.markRead(.olderThan7d) },
            ])
            return item

        default:
            return nil
        }
    }

    /// Wraps a SwiftUI view in Catalyst's UIView-hosting toolbar item. The view sizes itself;
    /// stores it reads are observed by SwiftUI, so these items need no manual mirroring.
    /// Hosted views inherit the window's appearance, which RootView keeps in step with the app
    /// theme — so the wordmark is always drawn for the glass it actually sits on.
    private func hostedItem<V: View>(_ identifier: NSToolbarItem.Identifier, _ view: V, label: String) -> NSToolbarItem {
        let host = UIHostingController(rootView: view)
        host.sizingOptions = .intrinsicContentSize
        host.view.backgroundColor = .clear
        host.view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        host.view.frame = CGRect(origin: .zero, size: host.view.intrinsicContentSize)
        hosts[identifier] = host
        let item = NSUIViewToolbarItem(itemIdentifier: identifier, uiView: host.view)
        item.label = label
        return item
    }

    // MARK: Actions

    private func goHome() {
        environment.navigation.goHome(feed: environment.feed, compact: false)
    }

    @objc private func cycleTheme() {
        environment.theme.cycle()
    }

    @objc private func fetchNewStories() {
        Task { await environment.feed.pollFeed() }
    }

    @objc private func openSettings() {
        environment.navigation.toggleSettings(compact: false)
    }

    @objc private func orderChanged(_ sender: NSToolbarItemGroup) {
        let order: FeedOrder = sender.selectedIndex == 1 ? .asc : .desc
        Task { await environment.feed.setOrder(order) }
    }

    @objc private func filterChanged(_ sender: NSToolbarItemGroup) {
        let filter = FeedStore.Filter.allCases[max(0, min(FeedStore.Filter.allCases.count - 1, sender.selectedIndex))]
        Task { await environment.feed.setFilter(filter) }
    }

    private func markRead(_ range: BulkMarkReadScope) {
        Task { await environment.feed.markBulkRead(range) }
    }

    // MARK: State mirroring

    /// Re-renders whenever any store property read inside `render()` changes.
    private func observe() {
        guard alive else { return }
        withObservationTracking {
            render()
        } onChange: { [weak self] in
            Task { @MainActor in self?.observe() }
        }
    }

    private func render() {
        let feed = environment.feed
        scene.title = environment.sources.title(for: feed.scope)
        scene.subtitle = "\(feed.unreadCount) unread"
        filterGroup?.selectedIndex = FeedStore.Filter.allCases.firstIndex(of: feed.filter) ?? 0
        orderGroup?.selectedIndex = feed.order == .desc ? 0 : 1
        updateWordmark(sidebarWidth: environment.layoutMetrics.sidebarWidth)

        // Native items can't be restyled in place; rebuild them when the state they show changes.
        if let built = themeBuiltPreference, built != environment.theme.preference { rebuild(ID.theme) }
        if let built = fetchBuiltBusy, built != (feed.polling || feed.loading) { rebuild(ID.refresh) }
    }

    /// Re-creates one item in place so the delegate builds it for the current state.
    private func rebuild(_ identifier: NSToolbarItem.Identifier) {
        guard let index = toolbar.items.firstIndex(where: { $0.itemIdentifier == identifier }) else { return }
        toolbar.removeItem(at: index)
        toolbar.insertItem(withItemIdentifier: identifier, at: index)
    }

    /// Full wordmark when the sidebar can hold it beside theme and Settings; the logo alone
    /// otherwise — never a truncated name and never an overflow chevron for these three.
    private func updateWordmark(sidebarWidth: CGFloat) {
        let logoOnly = sidebarWidth > 0 && sidebarWidth < Self.fullWordmarkMinSidebarWidth
        guard logoOnly != showsLogoOnly else { return }
        showsLogoOnly = logoOnly
        let current = toolbar.items.map(\.itemIdentifier)
        guard let index = current.firstIndex(where: { $0 == ID.wordmark || $0 == ID.logo }) else { return }
        toolbar.removeItem(at: index)
        toolbar.insertItem(withItemIdentifier: logoOnly ? ID.logo : ID.wordmark, at: index)
    }
}

/// Stands in for the Fetch button while a poll is running.
private struct MacFetchSpinner: View {
    var body: some View {
        ProgressView()
            .controlSize(.small)
            .frame(width: 28, height: 28)
            .accessibilityLabel("Fetching new stories…")
    }
}
#endif
