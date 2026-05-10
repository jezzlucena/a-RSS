import SwiftUI

struct DiagnosticsView: View {
    @State private var store = DiagnosticsStore()
    @State private var retrying: Set<String> = []

    var body: some View {
        Group {
            if store.loading && store.failures.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.failures.isEmpty {
                ContentUnavailableView(
                    "All clear",
                    systemImage: "checkmark.seal",
                    description: Text("Nothing has failed recently.")
                )
            } else {
                List {
                    Section {
                        Text("Entries the summarizer couldn't fetch or summarize. Common causes: hard paywalls, blocked archives, or transient network errors.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Section("Recent failures") {
                        ForEach(store.failures) { f in
                            FailureRow(
                                failure: f,
                                isRetrying: retrying.contains(f.id),
                                onRetry: { Task { await retry(f) } }
                            )
                        }
                    }
                    if let err = store.lastError {
                        Section {
                            Label(err, systemImage: "exclamationmark.triangle")
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
        }
        .navigationTitle("Diagnostics")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.load() }
        .task {
            if store.failures.isEmpty {
                await store.load()
            }
        }
    }

    private func retry(_ f: FailedEntrySummary) async {
        retrying.insert(f.id)
        defer { retrying.remove(f.id) }
        _ = await store.retry(id: f.id)
    }
}

private struct FailureRow: View {
    let failure: FailedEntrySummary
    let isRetrying: Bool
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(failure.title)
                    .font(.system(.body, design: .serif, weight: .semibold))
                    .lineLimit(2)
                Spacer()
                Text(failure.sourceTitle)
                    .font(.caption2.monospaced().smallCaps())
                    .foregroundStyle(.secondary)
            }
            if let url = URL(string: failure.url) {
                Link(failure.url, destination: url)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            if let error = failure.error {
                Text(error)
                    .font(.caption.monospaced())
                    .foregroundStyle(.red)
                    .lineLimit(3)
            }
            HStack {
                Spacer()
                Button {
                    onRetry()
                } label: {
                    if isRetrying {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("Retry", systemImage: "arrow.clockwise")
                            .labelStyle(.titleAndIcon)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(isRetrying)
            }
        }
        .padding(.vertical, 4)
    }
}
