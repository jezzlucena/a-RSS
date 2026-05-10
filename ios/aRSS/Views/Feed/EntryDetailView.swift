import SwiftUI

struct EntryDetailView: View {
    let entryId: String

    @State private var entry: EntryDetail?
    @State private var loading = true
    @State private var error: String?
    @State private var togglingRead = false

    private let api: APIClient = .shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if loading && entry == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                } else if let entry {
                    DetailContent(entry: entry)
                } else if let error {
                    Text(error)
                        .font(.callout)
                        .foregroundStyle(.red)
                        .padding(.top, 40)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let entry {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await toggleRead(entry: entry) }
                    } label: {
                        Image(systemName: entry.isRead ? "circle.dashed" : "checkmark.circle")
                            .accessibilityLabel(entry.isRead ? "Mark as unread" : "Mark as read")
                    }
                    .disabled(togglingRead)
                }
            }
        }
        .task(id: entryId) {
            await load()
        }
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            entry = try await api.get("/entries/\(entryId)")
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func toggleRead(entry: EntryDetail) async {
        guard !togglingRead else { return }
        togglingRead = true
        defer { togglingRead = false }
        let next = !entry.isRead
        // Optimistic
        self.entry = patched(entry, isRead: next)
        do {
            let response: SetEntryReadResponse = try await api.post(
                "/entries/\(entry.id)/read",
                body: SetEntryReadRequest(read: next)
            )
            self.entry = patched(entry, isRead: response.isRead)
        } catch {
            self.entry = patched(entry, isRead: !next) // revert
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func patched(_ e: EntryDetail, isRead: Bool) -> EntryDetail {
        EntryDetail(
            id: e.id,
            sourceId: e.sourceId,
            sourceTitle: e.sourceTitle,
            categoryId: e.categoryId,
            url: e.url,
            title: e.title,
            publishedAt: e.publishedAt,
            description: e.description,
            summary: e.summary,
            image: e.image,
            processingState: e.processingState,
            isRead: isRead,
            articleText: e.articleText,
            byline: e.byline
        )
    }
}

private struct DetailContent: View {
    let entry: EntryDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            // Source / time / byline chip
            HStack(spacing: 6) {
                Text(entry.sourceTitle)
                    .font(.caption2.monospaced().smallCaps().weight(.semibold))
                Text("·").foregroundStyle(.secondary)
                Text(timeAgo(from: entry.publishedAt))
                    .font(.caption2.monospaced().smallCaps())
                    .foregroundStyle(.secondary)
                if let byline = entry.byline, !byline.isEmpty {
                    Text("·").foregroundStyle(.secondary)
                    Text(byline)
                        .font(.caption2.monospaced().smallCaps())
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if !entry.isRead {
                    Circle().fill(.tint).frame(width: 8, height: 8)
                }
            }

            // Headline
            Text(entry.title)
                .font(.system(.largeTitle, design: .serif, weight: .semibold))
                .fixedSize(horizontal: false, vertical: true)

            // Hero image
            if let imageURL = entry.image.flatMap({ URL(string: $0.url) }) {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .empty: Rectangle().fill(.secondary.opacity(0.1))
                    case .success(let img):
                        img.resizable().aspectRatio(contentMode: .fill)
                    case .failure: Rectangle().fill(.secondary.opacity(0.1))
                    @unknown default: Color.clear
                    }
                }
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(.separator, lineWidth: 0.5)
                )
            }

            // Intro
            if let intro = entry.summary?.intro, !intro.isEmpty {
                Text(intro)
                    .font(.system(.title3, design: .serif).italic())
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Bullets
            if let bullets = entry.summary?.bullets {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Three bullets")
                        .font(.caption2.monospaced().smallCaps())
                        .foregroundStyle(.secondary)
                    ForEach(Array(bullets.enumerated()), id: \.offset) { _, b in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("—")
                                .font(.system(.body, design: .serif))
                                .foregroundStyle(.tint)
                            Text(b)
                                .font(.body)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            // Article body
            if let paragraphs = paragraphs() {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Full article")
                        .font(.caption2.monospaced().smallCaps())
                        .foregroundStyle(.secondary)
                        .padding(.top, 8)
                    ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, p in
                        Text(p)
                            .font(.system(.body, design: .serif))
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            } else if entry.processingState == .pending {
                Text("Awaiting summary…")
                    .font(.system(.body, design: .serif).italic())
                    .foregroundStyle(.secondary)
            }

            // Open at source
            Divider().padding(.top, 8)
            HStack {
                if let url = URL(string: entry.url) {
                    Link(destination: url) {
                        Label("Open at source", systemImage: "arrow.up.right.square")
                            .font(.caption.monospaced().smallCaps())
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.regular)
                }
                Spacer()
                if let summary = entry.summary {
                    Text(summary.model)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
        }
    }

    private func paragraphs() -> [String]? {
        guard let text = entry.articleText, !text.isEmpty else { return nil }
        let parts = text
            .split(separator: "\n\n", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts
    }

    private func timeAgo(from iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let alt = ISO8601DateFormatter()
        guard let date = f.date(from: iso) ?? alt.date(from: iso) else { return iso }
        let r = RelativeDateTimeFormatter()
        r.unitsStyle = .abbreviated
        return r.localizedString(for: date, relativeTo: Date())
    }
}
