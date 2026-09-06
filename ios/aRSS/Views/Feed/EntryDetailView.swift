import SwiftUI

/// Mirrors apps/web/src/pages/EntryDetail.tsx. Auto-summarizes silently, never auto-marks read,
/// and — unlike the web — a failed read toggle reverts with a toast instead of replacing the page.
@Observable
final class EntryDetailModel {
    let id: String
    private(set) var entry: EntryDetail?
    private(set) var loading = false
    private(set) var summarizing = false
    private(set) var togglingRead = false
    private(set) var error: String?

    private let api: any ARSSAPI
    private let auth: AuthStore
    private let feed: FeedStore
    private let sources: SourcesStore
    private let toasts: ToastCenter
    private let summarizer: any Summarizing

    init(id: String, api: any ARSSAPI, auth: AuthStore, feed: FeedStore, sources: SourcesStore, toasts: ToastCenter, summarizer: any Summarizing) {
        self.id = id
        self.api = api
        self.auth = auth
        self.feed = feed
        self.sources = sources
        self.toasts = toasts
        self.summarizer = summarizer
    }

    func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let detail = try await api.entryDetail(id: id)
            entry = detail
            if detail.summary == nil, detail.processingState == .fetched {
                summarizing = true
                defer { summarizing = false }
                // Web swallows summarize failures here; the article body still renders.
                if let response = try? await summarizer.summarize(id: id) {
                    entry?.summary = response.summary
                    entry?.processingState = response.processingState
                    feed.applySummary(id: id, response: response)
                }
            }
        } catch {
            auth.noteError(error)
            self.error = error.userMessage(fallback: "Could not load entry")
        }
    }

    func toggleRead() async {
        guard let current = entry, !togglingRead else { return }
        let next = !current.isRead
        togglingRead = true
        defer { togglingRead = false }
        entry?.isRead = next
        do {
            _ = try await api.setEntryRead(id: id, read: next)
            feed.applyReadState(id: id, isRead: next)
            Task { await sources.refreshUnreadCounts() }
        } catch {
            entry?.isRead = !next
            auth.noteError(error)
            toasts.report(error, fallback: "Could not update read state")
        }
    }
}

struct EntryDetailView: View {
    let id: String

    @Environment(AppEnvironment.self) private var environment
    @Environment(FeedStore.self) private var feed
    @Environment(AppNavigation.self) private var navigation
    @Environment(\.usesSplitLayout) private var usesSplitLayout
    @Environment(\.dismiss) private var dismiss
    @State private var model: EntryDetailModel?

    var body: some View {
        Group {
            if let model {
                content(model)
            } else {
                Color.paper
            }
        }
        .background(Color.paper.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if model == nil {
                model = EntryDetailModel(
                    id: id, api: environment.api, auth: environment.auth, feed: feed,
                    sources: environment.sources, toasts: environment.toasts, summarizer: environment.summarizer
                )
            }
            await model?.load()
        }
    }

    @ViewBuilder
    private func content(_ model: EntryDetailModel) -> some View {
        if model.loading, model.entry == nil {
            ProgressView("Loading entry…").font(.chip).tint(.vermilion)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let entry = model.entry {
            article(entry, model: model)
        } else {
            VStack(alignment: .leading, spacing: 16) {
                ErrorBanner(message: model.error ?? "Entry not found.") { Task { await model.load() } }
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private func article(_ entry: EntryDetail, model: EntryDetailModel) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(spacing: 6) {
                    Text(entry.sourceTitle).foregroundStyle(Color.ink)
                    Text("·").foregroundStyle(Color.muted)
                    Text(TimeAgo.string(from: entry.publishedAt)).foregroundStyle(Color.muted)
                    if let byline = entry.byline, !byline.isEmpty {
                        Text("·").foregroundStyle(Color.muted)
                        Text(byline).foregroundStyle(Color.muted).lineLimit(1)
                    }
                }
                .font(.chip)

                Text(entry.title)
                    .font(.display)
                    .foregroundStyle(Color.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)

                if let imageURL = entry.image.flatMap({ URL(string: $0.url) }) {
                    RemoteImage(url: imageURL, aspectRatio: 16 / 9)
                        .overlay(Rectangle().stroke(Color.rule, lineWidth: 1))
                }

                if model.summarizing, entry.summary == nil {
                    HStack(spacing: 8) {
                        ProgressView().tint(.vermilion).controlSize(.small)
                        KickerText(environment.summarizer.progressLabel)
                    }
                }

                if let summary = entry.summary {
                    if let intro = summary.intro, !intro.isEmpty {
                        Text(intro).font(.introSerif).foregroundStyle(Color.ink).textSelection(.enabled)
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        KickerText("Three bullets")
                        ForEach(Array(summary.bullets.enumerated()), id: \.offset) { _, bullet in
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text("—").foregroundStyle(Color.vermilion)
                                Text(bullet).textSelection(.enabled)
                            }
                            .font(.bodySerif)
                            .foregroundStyle(Color.ink)
                        }
                    }
                }

                if let text = entry.articleText?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        KickerText("Full article")
                        Text(text)
                            .font(.bodySerif)
                            .foregroundStyle(Color.ink)
                            .textSelection(.enabled)
                    }
                } else {
                    Text("The article body wasn't extracted. Open the original source below.")
                        .font(.bodySerif.italic())
                        .foregroundStyle(Color.muted)
                }

                Rectangle().fill(Color.rule).frame(height: 1)
                HStack {
                    if let url = URL(string: entry.url) {
                        Link("Open at source ↗", destination: url).foregroundStyle(Color.vermilion)
                    }
                    Spacer()
                    Text(entry.summary?.model ?? entry.processingState.rawValue).foregroundStyle(Color.muted)
                }
                .font(.chip)
            }
            .padding(24)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button(entry.isRead ? "Mark as unread" : "Mark as read", systemImage: entry.isRead ? "circle" : "checkmark.circle") {
                    Task { await model.toggleRead() }
                }
                .disabled(model.togglingRead)
                Button("\(entry.sourceTitle) →") {
                    feed.select(.source(entry.sourceId))
                    navigation.showFeed(compact: !usesSplitLayout)
                    dismiss()
                }
                .font(.chip)
            }
        }
    }
}
