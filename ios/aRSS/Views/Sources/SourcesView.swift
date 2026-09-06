import SwiftUI
import UniformTypeIdentifiers

/// Mirrors apps/web/src/pages/Sources.tsx: add form, OPML import/export, and the editable list.
struct SourcesView: View {
    @Environment(SourcesStore.self) private var sources
    @Environment(ToastCenter.self) private var toasts

    @State private var feedUrl = ""
    @State private var newCategoryId: String?
    @State private var adding = false
    @State private var addError: String?

    @State private var showImporter = false
    @State private var importing = false
    @State private var opmlStatus: String?
    @State private var opmlError: String?
    @State private var exportDocument: OPMLDocument?
    @State private var showExporter = false

    var body: some View {
        List {
            Section {
                TextField("https://example.com/feed.xml", text: $feedUrl)
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.go)
                    .onSubmit { Task { await addSource() } }
                Picker("Category", selection: $newCategoryId) {
                    Text("Uncategorized").tag(String?.none)
                    ForEach(sources.categories) { category in
                        Text(category.name).tag(Optional(category.id))
                    }
                }
                if let addError {
                    ErrorBanner(message: addError)
                }
                Button {
                    Task { await addSource() }
                } label: {
                    Text(adding ? "Adding…" : "Add feed").frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassProminent)
                .disabled(adding || feedUrl.trimmingCharacters(in: .whitespaces).isEmpty)
            } header: {
                KickerText("Add a feed")
            }

            Section {
                Button("Import OPML…", systemImage: "square.and.arrow.down") { showImporter = true }
                    .disabled(importing)
                Button("Export OPML", systemImage: "square.and.arrow.up") { Task { await exportOPML() } }
                if importing {
                    HStack(spacing: 8) { ProgressView().controlSize(.small); KickerText("Importing…") }
                }
                if let opmlStatus {
                    StatusText(message: opmlStatus)
                }
                if let opmlError {
                    ErrorBanner(message: opmlError)
                }
            } header: {
                KickerText("OPML")
            } footer: {
                Text("Paywall bypass uses public archives and crawler user-agents and may violate some publishers' Terms of Service. Set a source to *Bypass off* to fetch it normally.")
            }

            Section {
                if sources.hasLoaded, sources.sources.isEmpty {
                    Text("No sources yet. Add a feed URL above or import OPML.")
                        .font(.bodySerif.italic())
                        .foregroundStyle(Color.muted)
                }
                ForEach(sources.sources) { source in
                    SourceRow(source: source)
                }
            } header: {
                KickerText("Sources")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.paper.ignoresSafeArea())
        .navigationTitle("Sources")
        .refreshable { await sources.load() }
        .task { if !sources.hasLoaded { await sources.load() } }
        .fileImporter(
            isPresented: $showImporter,
            allowedContentTypes: [OPMLDocument.opmlType, .xml, .plainText, .data]
        ) { result in
            Task { await importOPML(result) }
        }
        .fileExporter(
            isPresented: $showExporter,
            document: exportDocument,
            contentType: OPMLDocument.opmlType,
            defaultFilename: "a-rss-subscriptions.opml"
        ) { result in
            if case .failure(let error) = result { toasts.report(error, fallback: "Export failed") }
        }
    }

    /// Web: only the URL field is cleared on success; the category selection sticks.
    private func addSource() async {
        let url = feedUrl.trimmingCharacters(in: .whitespaces)
        guard !url.isEmpty else { return }
        adding = true
        addError = nil
        defer { adding = false }
        do {
            _ = try await sources.createSource(feedUrl: url, categoryId: newCategoryId)
            feedUrl = ""
        } catch {
            addError = error.userMessage(fallback: "Could not add source")
        }
    }

    private func importOPML(_ result: Result<URL, any Error>) async {
        opmlStatus = nil
        opmlError = nil
        do {
            let url = try result.get()
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            let xml = String(decoding: try Data(contentsOf: url), as: UTF8.self)
            importing = true
            defer { importing = false }
            let outcome = try await sources.importOPML(xml: xml)
            opmlStatus = "Imported \(outcome.importedSources) feeds, \(outcome.importedCategories) categories (\(outcome.skippedSources) duplicates skipped)."
        } catch {
            opmlError = error.userMessage(fallback: "OPML import failed")
        }
    }

    private func exportOPML() async {
        do {
            exportDocument = OPMLDocument(data: try await sources.exportOPML())
            showExporter = true
        } catch {
            toasts.report(error, fallback: "Export failed")
        }
    }
}
