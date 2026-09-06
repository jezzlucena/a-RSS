import Foundation

/// Port of apps/web/src/lib/timeAgo.ts: walk the unit ladder and format the first unit the
/// duration fits in, with "named" phrasing ("yesterday", "now") like Intl's `numeric: 'auto'`.
enum TimeAgo {
    private static let divisions: [(amount: Double, unit: Calendar.Component)] = [
        (60, .second), (60, .minute), (24, .hour), (7, .day), (4.34524, .weekOfMonth), (12, .month), (.infinity, .year),
    ]

    static func string(from date: Date, relativeTo now: Date = .now, locale: Locale = .autoupdatingCurrent) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = locale
        formatter.dateTimeStyle = .named
        formatter.unitsStyle = .full

        var duration = date.timeIntervalSince(now) // negative for the past, like the web
        for division in divisions {
            if abs(duration) < division.amount {
                var components = DateComponents()
                components.setValue(Int(duration.rounded()), for: division.unit)
                return formatter.localizedString(from: components)
            }
            duration /= division.amount
        }
        return formatter.localizedString(for: date, relativeTo: now)
    }
}
