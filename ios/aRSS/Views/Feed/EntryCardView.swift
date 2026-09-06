import SwiftUI

/// One feed card (web `EntryCard`): metadata row, image, title, and the expanded body.
struct EntryCardView: View {
    let entry: Entry
    let onOpenDetail: (String) -> Void

    @Environment(FeedStore.self) private var feed
    @Environment(\.usesSplitLayout) private var usesSplitLayout

    private var isExpanded: Bool { feed.expandedID == entry.id }
    private var imageURL: URL? { entry.image.flatMap { URL(string: $0.url) } }

    var body: some View {
        VStack(alignment: .leading, spacing: usesSplitLayout ? 10 : 14) {
            metadataRow

            // Side-by-side layouts have less room per column: the illustration becomes a
            // thumbnail beside the title. In the tab layout it stays a full-width picture.
            if usesSplitLayout, let imageURL {
                HStack(alignment: .top, spacing: 14) {
                    imageButton(imageURL, maxWidth: 120)
                    titleButton
                }
            } else {
                if let imageURL {
                    imageButton(imageURL, maxWidth: 448)
                        .frame(maxWidth: .infinity)
                }
                titleButton
            }

            if entry.processingState == .failed, let error = entry.error {
                Text(error)
                    .font(.chip)
                    .foregroundStyle(Color.vermilionDeep)
                    .lineLimit(3)
            }

            // The wrapper's height animates 0 ↔ content while the body slides in from the top;
            // clipping the wrapper keeps the slide inside that growing region instead of over
            // the title and illustration above.
            VStack(alignment: .leading, spacing: 0) {
                if isExpanded {
                    EntryExpandedBody(entry: entry, onOpenDetail: onOpenDetail)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .clipped()
        }
        .padding(.vertical, usesSplitLayout ? 12 : 24)
        .opacity(entry.isRead ? 0.4 : 1)
        .animation(.snappy, value: isExpanded)
        .contentShape(Rectangle())
    }

    private func imageButton(_ url: URL, maxWidth: CGFloat) -> some View {
        Button { feed.toggleExpanded(entry.id) } label: {
            RemoteImage(url: url, aspectRatio: 4 / 3)
                .overlay(Rectangle().stroke(isExpanded ? Color.vermilion : Color.rule, lineWidth: 1))
                .frame(maxWidth: maxWidth)
        }
        .buttonStyle(.plain)
        .disabled(!entry.canExpand)
        .accessibilityLabel(isExpanded ? "Collapse article" : "Expand article")
    }

    /// Not a Button on purpose: a tap toggles expansion while a long press selects the text
    /// for copying (a Button would swallow the long press).
    private var titleButton: some View {
        Text(entry.title)
            .font(.headlineSerif)
            .foregroundStyle(entry.canExpand ? Color.ink : Color.muted)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .textSelection(.enabled)
            .contentShape(Rectangle())
            .onTapGesture { if entry.canExpand { feed.toggleExpanded(entry.id) } }
            .accessibilityAddTraits(.isHeader)
            .accessibilityAction(named: isExpanded ? "Collapse article" : "Expand article") {
                if entry.canExpand { feed.toggleExpanded(entry.id) }
            }
            .accessibilityIdentifier("entry.title")
    }

    private var metadataRow: some View {
        HStack(alignment: .center, spacing: 8) {
            if !entry.isRead {
                Circle().fill(Color.vermilion).frame(width: 6, height: 6)
                    .accessibilityLabel("Unread")
            }
            Text(entry.sourceTitle).foregroundStyle(Color.ink)
            Text("·").foregroundStyle(Color.muted)
            Text(TimeAgo.string(from: entry.publishedAt)).foregroundStyle(Color.muted)
            switch entry.processingState {
            case .pending:
                Text("· fetching").foregroundStyle(Color.muted)
            case .failed:
                Text("· fetch failed").foregroundStyle(Color.vermilionDeep)
                Button("Retry", systemImage: "arrow.clockwise") { Task { await feed.retryEntry(entry.id) } }
                    .buttonStyle(.plain)
                    .foregroundStyle(Color.vermilion)
                    .help("Re-fetch this article")
            default:
                EmptyView()
            }
            Spacer()
            Button {
                Task { await feed.toggleRead(entry.id) }
            } label: {
                Image(systemName: entry.isRead ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(entry.isRead ? Color.vermilion : Color.muted)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(entry.isRead ? "Mark as unread" : "Mark as read")
            .accessibilityAddTraits(entry.isRead ? [.isSelected] : [])
        }
        .font(.chip)
        .lineLimit(1)
    }
}

/// The expanded body: summarizing notice → inline error (+Try again when retryable) → intro +
/// bullets → fallback article text → footer links.
struct EntryExpandedBody: View {
    let entry: Entry
    let onOpenDetail: (String) -> Void

    @Environment(FeedStore.self) private var feed
    @Environment(SummarizationService.self) private var summarizer
    @Environment(AppNavigation.self) private var navigation
    @Environment(\.usesSplitLayout) private var usesSplitLayout

    private var summarizing: Bool { feed.summarizing.contains(entry.id) }
    private var failure: FeedStore.SummaryFailure? { feed.summaryFailures[entry.id] }
    private var fallback: String? { feed.fallbackBodies[entry.id] }
    private var loadingFallback: Bool { feed.loadingFallback.contains(entry.id) }
    private var shouldLoadFallback: Bool {
        entry.summary == nil && !summarizing && entry.processingState != .pending && fallback == nil && !loadingFallback
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if summarizing {
                HStack(spacing: 8) {
                    ProgressView().tint(.vermilion).controlSize(.small)
                    KickerText(summarizer.progressLabel)
                }
            }

            if let failure {
                ErrorBanner(
                    message: failure.message,
                    retry: failure.retryable ? { Task { await feed.summarize(entry.id) } } : nil,
                    action: failure.code == "llm_not_configured"
                        ? .init(label: "Open Settings") { navigation.open(.settings, compact: !usesSplitLayout) }
                        : nil
                )
            }

            if let summary = entry.summary {
                if let intro = summary.intro, !intro.isEmpty {
                    Text(intro).font(.introSerif).foregroundStyle(Color.ink).textSelection(.enabled)
                }
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(summary.bullets.enumerated()), id: \.offset) { _, bullet in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text("—").foregroundStyle(Color.vermilion)
                            Text(bullet).textSelection(.enabled)
                        }
                        .font(.bodySerif)
                        .foregroundStyle(Color.ink)
                    }
                }
            } else if !summarizing {
                if entry.processingState == .pending {
                    Text("Article is still being fetched. Try again in a moment.")
                        .font(.bodySerif.italic()).foregroundStyle(Color.muted)
                } else if loadingFallback {
                    KickerText("Loading article…")
                } else if let fallback, !fallback.isEmpty {
                    Text(fallback)
                        .font(.bodySerif)
                        .foregroundStyle(Color.ink)
                        .textSelection(.enabled)
                }
            }

            HStack {
                Button("Full article ↗") { onOpenDetail(entry.id) }
                    .buttonStyle(.plain)
                    .foregroundStyle(Color.vermilion)
                Spacer()
                if let url = URL(string: entry.url) {
                    Link("Open source ↗", destination: url)
                        .foregroundStyle(Color.vermilion)
                }
            }
            .font(.chip)
        }
        .task(id: fallbackTrigger) {
            if shouldLoadFallback { await feed.loadFallbackBody(entry.id) }
        }
    }

    /// Re-evaluates the fallback fetch whenever the inputs to `shouldLoadFallback` change.
    private var fallbackTrigger: String {
        "\(entry.summary == nil)|\(summarizing)|\(entry.processingState.rawValue)|\(fallback == nil)"
    }
}
