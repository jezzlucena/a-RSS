import SwiftUI

struct EntryCardView: View {
    let entry: Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(entry.sourceTitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text("·")
                    .foregroundStyle(.secondary)
                Text(timeAgo(from: entry.publishedAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if !entry.isRead {
                    Circle().fill(.tint).frame(width: 8, height: 8)
                }
            }

            HStack(alignment: .top, spacing: 12) {
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
                    .frame(width: 96, height: 72)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(entry.title)
                        .font(.system(.headline, design: .serif, weight: .semibold))
                        .lineLimit(3)
                    if let intro = entry.summary?.intro, !intro.isEmpty {
                        Text(intro)
                            .font(.system(.subheadline, design: .serif).italic())
                            .foregroundStyle(.primary.opacity(0.85))
                            .lineLimit(3)
                    }
                    if let bullets = entry.summary?.bullets {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(Array(bullets.enumerated()), id: \.offset) { _, b in
                                HStack(alignment: .top, spacing: 6) {
                                    Text("—")
                                        .font(.system(.subheadline, design: .serif))
                                        .foregroundStyle(.tint)
                                    Text(b).font(.subheadline)
                                }
                            }
                        }
                    } else if let description = entry.description, !description.isEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                    } else if entry.processingState == .pending {
                        Text("Awaiting summary…")
                            .font(.subheadline)
                            .foregroundStyle(.tertiary)
                            .italic()
                    }
                }
            }

            if let url = URL(string: entry.url) {
                Link(destination: url) {
                    Label("Open source", systemImage: "arrow.up.right.square")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(.background)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(.separator, lineWidth: 1)
                )
        )
        .opacity(entry.isRead ? 0.65 : 1.0)
    }

    private func timeAgo(from iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let alt = ISO8601DateFormatter()
        guard let date = formatter.date(from: iso) ?? alt.date(from: iso) else { return iso }
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f.localizedString(for: date, relativeTo: Date())
    }
}
