import SwiftUI

/// A fixed-aspect image box: the picture fills and crops inside it (the web's `object-cover`),
/// and the box itself never grows past its container. Placeholder is the paper-deep tone.
struct RemoteImage: View {
    let url: URL
    let aspectRatio: CGFloat

    var body: some View {
        Color.paperDeep
            .aspectRatio(aspectRatio, contentMode: .fit)
            .overlay {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Color.paperDeep
                    }
                }
            }
            .clipped()
            .accessibilityHidden(true)
    }
}
