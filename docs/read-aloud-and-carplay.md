# Read aloud and CarPlay

## ElevenLabs setup

Deploy the API and clients together. No new server environment variables are needed:
`USER_SECRETS_KEY` encrypts each account's ElevenLabs key using the existing AES-GCM
secret store. Keep this key stable across API deployments.

On web or iOS, open **Settings → Read aloud**, select **ElevenLabs**, enter the account's
API key, and save. The key needs Text to Speech permission. Settings sync through the
account. The default voice is George (`JBFqnCBsd6RMkjVDRZzb`) with
`eleven_multilingual_v2`; another accessible voice ID or text-to-speech model ID can
be supplied. Leave the key field blank to keep a saved key. Removing it switches the
account back to the free system voice.

If saving reports that Read aloud settings are unavailable (HTTP 404), the app
could not reach the speech-settings API route. Deploy the API containing
`PUT /api/v1/me/speech` and check that the app's API base URL and reverse proxy point
to that deployment. Rebuilding the iOS app alone does not update the API server.
Saving stores the settings; ElevenLabs validates the key, voice and model when
audio is requested. A missing settings route does not establish that those values
are invalid.

The text being played goes to ElevenLabs and uses that account's credits. Keys are
never returned to either client. Audio is requested only on playback, one segment
at a time, through authenticated `POST /speech` calls. Segments are bounded to 4,000
UTF-16 units; stopping cancels pending requests and discards late responses. There
is no persisted audio cache or automatic retry of paid synthesis. Playback errors
remain visible instead of silently changing the selected voice. Web uses Web Audio,
resumed during the button tap so fetching does not lose browser audio permission.

The existing reading rules remain: feed cards read their summary (or displayed body
fallback); article details read the full article (or summary fallback). CarPlay
always reads summaries, generating a missing summary on demand with the configured
summarizer. It never reads the full article as a fallback in the car.

## CarPlay distribution

Apple must approve the app for the **CarPlay audio** entitlement before signing a
physical-device or distribution build containing `com.apple.developer.carplay-audio`.
Request access through [Apple's CarPlay developer page](https://developer.apple.com/carplay/),
enable it for the app identifier, and regenerate the iOS provisioning profiles.
The repository includes the entitlement in `ios/project.yml` and
`ios/aRSS/aRSS.entitlements`; the Catalyst entitlements remain separate.

Run `./ios/scripts/generate.sh` after changing the project spec. It generates the
CarPlay scene manifest, registers `CarPlaySceneDelegate`, and enables background
audio. The SwiftUI window and CarPlay scene share one authentication session and
player, including when CarPlay connects before the phone window opens.

The car shows a paged list of article titles and Apple's Now Playing controls.
Article descriptions, summary text, bylines and images are absent from the car
interface and Now Playing metadata. Operational labels and errors remain visible.
Selecting an article starts its summary and continues through the loaded queue.
Play/pause, next, previous and stop use the system media commands. Refresh and More
articles fetch more titles without reordering the active queue. Disconnecting the
car pauses playback. Sign-out stops playback and clears the car's private library.
Internet access is required for the library, cloud summaries and ElevenLabs audio.

## Verification

Automated checks:

- `pnpm build`
- `pnpm --filter @a-rss/api test`
- `pnpm --filter @a-rss/web test` (Node unit tests; no browser/UI automation)
- `xcodebuild -project ios/aRSS.xcodeproj -scheme aRSS -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:aRSSTests test`

Following `CLAUDE.md`, UI, audible quality and driving-device checks are performed
by the developer. Verify:

1. iOS Categories: swipe Delete → Cancel, swipe Delete → confirm, context-menu
   deletion, a failed/offline delete, and deleting the currently selected category.
   Sources should remain uncategorized; cancelling or failure must keep the row.
2. Both clients: save/replace/remove the ElevenLabs key, choose another voice,
   play a summary and a long full article, stop while audio is loading, rapidly
   switch articles, and test an invalid key or exhausted quota.
3. iOS: lock the phone during playback, pause/resume from the lock screen, interrupt
   with a call/Siri, and disconnect the audio output.
4. With Apple's entitlement and a CarPlay simulator or vehicle: cold-connect,
   sign in on the phone, refresh/page titles, start a missing summary, advance/back,
   switch playback between phone and car, disconnect/reconnect, sign out, and try
   a network or generation failure. Confirm that only article titles appear as
   article content on the car screen.

ElevenLabs requests in unit tests are mocked; no real account credits are spent by
these checks. Integration reference: [ElevenLabs Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).
