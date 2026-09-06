import SwiftUI

/// Shared chrome for the sign-in screens: the masthead from the web login page, then the form.
struct AuthScaffold<Content: View>: View {
    let heading: String
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 12) {
                    KickerText("Issue No. 001 · \(Calendar.current.component(.year, from: .now))")
                    Wordmark(size: .display)
                    Text("Another RSS Software Solution. ")
                        .font(.bodySerif)
                        .foregroundStyle(Color.muted)
                    + Text("Three bullets per story.")
                        .font(.bodySerif.italic())
                        .foregroundStyle(Color.ink)
                    + Text(" Drafted by Claude, sent to your morning.")
                        .font(.bodySerif)
                        .foregroundStyle(Color.muted)
                }
                Rectangle().fill(Color.ink).frame(height: 2)
                KickerText(heading, color: .ink)
                content
            }
            .padding(24)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color.paper.ignoresSafeArea())
    }
}

/// Labeled text field in the newspaper style: kicker label above, hairline rule below.
struct FormField<Field: View>: View {
    let label: String
    @ViewBuilder var field: Field

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            KickerText(label)
            field
                .font(.body)
                .foregroundStyle(Color.ink)
                .padding(.vertical, 8)
            Rectangle().fill(Color.rule).frame(height: 1)
        }
    }
}
