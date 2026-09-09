#if !targetEnvironment(macCatalyst)
import CarPlay
import Observation

/// The scene can connect without a phone window. It uses the same process-wide session and
/// player as SwiftUI and hydrates authentication itself before loading the library.
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    private var interfaceController: CPInterfaceController?
    private var list: CPListTemplate?
    private var loadTask: Task<Void, Never>?
    private var connection = UUID()
    private var pageStart = 0
    private var lastError: UUID?
    private var pageSize: Int { max(1, CPListTemplate.maximumItemCount - 2) }
    private let environment = AppEnvironment.shared

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didConnect interfaceController: CPInterfaceController) {
        self.interfaceController = interfaceController
        connection = UUID()
        pageStart = 0
        lastError = environment.speech.failureID
        let template = CPListTemplate(title: "a-RSS", sections: [])
        template.emptyViewTitleVariants = ["Loading…"]
        template.emptyViewSubtitleVariants = []
        template.trailingNavigationBarButtons = [CPBarButton(title: "Refresh") { [weak self] _ in self?.reload() }]
        list = template
        interfaceController.setRootTemplate(template, animated: false, completion: nil)
        observe(connection: connection)
        reload()
    }

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didDisconnectInterfaceController interfaceController: CPInterfaceController) {
        connection = UUID()
        loadTask?.cancel(); loadTask = nil
        self.interfaceController = nil; list = nil
        // Disconnecting the car should not unexpectedly send speech through the phone speaker.
        environment.speech.pause()
    }

    private func reload(more: Bool = false) {
        guard !environment.listening.loading else { return }
        if !more { pageStart = 0 }
        let oldCount = environment.listening.entries.count
        loadTask = Task { [weak self] in
            guard let self else { return }
            await environment.listening.load(more: more)
            guard !Task.isCancelled else { return }
            if more, environment.listening.entries.count > oldCount { pageStart = oldCount }
            render()
        }
    }

    private func observe(connection token: UUID) {
        guard token == connection, interfaceController != nil else { return }
        withObservationTracking {
            render()
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.observe(connection: token) }
        }
    }

    private func render() {
        guard let list else { return }
        let library = environment.listening
        let signedIn = environment.auth.status == .authenticated
        let speakingID = environment.speech.speakingID
        list.emptyViewTitleVariants = [signedIn ? (library.error ?? (library.loading ? "Loading…" : "No summaries available")) : "Sign in on your iPhone"]
        list.emptyViewSubtitleVariants = []
        var rows: [CPListItem] = []
        if signedIn {
            // Page within the car's item limit, which can be smaller than an API page.
            for entry in library.entries.dropFirst(pageStart).prefix(pageSize) {
                let item = CPListItem(text: entry.title, detailText: nil)
                item.isPlaying = speakingID == "carplay:" + entry.id
                item.handler = { [weak self] _, completion in
                    guard let self else { completion(); return }
                    environment.listening.play(id: entry.id)
                    if interfaceController?.topTemplate !== CPNowPlayingTemplate.shared {
                        interfaceController?.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
                    }
                    completion()
                }
                rows.append(item)
            }
            if pageStart > 0 {
                let previous = CPListItem(text: "Previous articles", detailText: nil)
                previous.handler = { [weak self] _, completion in
                    if let self { pageStart = max(0, pageStart - pageSize); render() }
                    completion()
                }
                rows.insert(previous, at: 0)
            }
            if pageStart + pageSize < library.entries.count || library.nextCursor != nil {
                let more = CPListItem(text: library.loading ? "Loading…" : "More articles", detailText: nil)
                more.handler = { [weak self] _, completion in
                    if let self {
                        if pageStart + pageSize < library.entries.count { pageStart += pageSize; render() }
                        else { reload(more: true) }
                    }
                    completion()
                }
                rows.append(more)
            }
        }
        list.updateSections(rows.isEmpty ? [] : [CPListSection(items: rows)])
        if let failure = environment.speech.failureID, failure != lastError {
            lastError = failure
            let alert = CPAlertTemplate(titleVariants: ["Unable to play. Check a-RSS on your iPhone."], actions: [CPAlertAction(title: "OK", style: .default) { [weak self] _ in
                self?.interfaceController?.dismissTemplate(animated: true, completion: nil)
            }])
            if interfaceController?.presentedTemplate == nil { interfaceController?.presentTemplate(alert, animated: true, completion: nil) }
        }
        if !signedIn, interfaceController?.topTemplate !== list {
            interfaceController?.popToRootTemplate(animated: false, completion: nil)
        }
    }
}
#endif
