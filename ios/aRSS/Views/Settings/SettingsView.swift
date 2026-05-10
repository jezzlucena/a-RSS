import SwiftUI

struct SettingsView: View {
    @Environment(AuthStore.self) private var auth

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    if let me = auth.me {
                        LabeledContent("Email", value: me.email)
                        if let displayName = me.displayName {
                            LabeledContent("Name", value: displayName)
                        }
                        LabeledContent("Sign-in methods", value: me.authMethods.map(\.rawValue).joined(separator: ", "))
                    }
                }
                Section("Diagnostics") {
                    NavigationLink {
                        DiagnosticsView()
                    } label: {
                        Label("Recent processing failures", systemImage: "exclamationmark.triangle")
                    }
                }
                Section {
                    Button(role: .destructive) {
                        Task { await auth.logout() }
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
                Section("About") {
                    LabeledContent("Version", value: "0.1.0")
                    Link("a-RSS source", destination: URL(string: "https://a-rss.app")!)
                }
            }
            .navigationTitle("Settings")
        }
    }
}
