# a-RSS

RSS reader that polls user-configured feeds, fetches each article through a
paywall-bypass chain, and summarizes it on demand into an intro sentence + 3 bullets via
Claude. pnpm monorepo (`apps/*`, `packages/*`) plus a native iOS app outside the
workspace. Solo-developer project, personal-use scale — optimize for clarity and
correctness over throughput.

## Layout

```
apps/api          Express 4 + TypeScript, Mongoose 8, Agenda jobs, pino logging
apps/web          React 19 + Vite 6 + Zustand 5 + Tailwind 3 (+ react-toastify)
packages/shared   Zod schemas + inferred types, consumed as compiled dist/ (@a-rss/shared)
ios/              SwiftUI client (iOS 26, Swift 6, Liquid Glass). XcodeGen project.yml is
                  the source of truth; aRSS.xcodeproj is generated and gitignored. Not in
                  the pnpm workspace. See "iOS" below.
docker-compose.yml  mongo, minio, ladder, flaresolverr, and the `dev` container
.env.example      Every env var, grouped and commented. Copy to .env.
```

`apps/api/src`: `routes/` (thin routers) → `controllers/` (parse, authorize, query,
serialize) → `services/` (everything non-HTTP) and `models/` (Mongoose). `jobs/` holds
Agenda job bodies that know nothing about Agenda. `middleware/` has `requireAuth` and
the `HttpError`/`errorHandler` pair. `config/env.ts` is the only file that reads
`process.env`.

`apps/web/src`: `pages/` (one default-exported component per route), `components/`
(only Layout, RequireAuth, GoogleButton, ReadAloudButton — named exports), `stores/` (Zustand),
`lib/` (`api.ts` fetch client, `timeAgo.ts`, `readAloud.ts` speech synthesis), `styles/index.css`
(palette tokens).
Sub-components used by exactly one page live at the bottom of that page's file.

## Running it — Docker is the default

```bash
docker compose up --build -d
docker logs arss-dev -f         # both apps, prefixed "apps/api dev:" / "apps/web dev:"
```

The `dev` container (stock `node:20-bookworm-slim`) runs `pnpm install
--frozen-lockfile && pnpm -r --parallel run dev` on every `up`, so pulling new deps
needs no separate install. Source is bind-mounted; edits hot-reload. Restart only for
a new dependency or env var change. `--build` is a no-op today (no `build:` contexts)
but pass it anyway.

- Web: http://localhost:8088 (Vite on 5173 inside) · API: http://localhost:5088, mounted at `/api/v1`
- Mongo: localhost:27020 (non-standard port) · MinIO console: 9001 · Ladder: 8190 · FlareSolverr: 8191

`node_modules` (root and each workspace) are named volumes, not bind mounts, so the
container's install always wins over a stale host copy. Bad dependency state:
`docker compose down` then `up --build -d`. Add `-v` only to wipe Mongo/MinIO data —
ask first on anyone else's stack.

Without Docker: `pnpm install && pnpm dev` (scripts wrap `dotenv -e .env --`), but you
must supply Mongo/MinIO/Ladder yourself. Prefer Docker.

## Environment

Single root `.env`, validated by `apps/api/src/config/env.ts` (Zod `safeParse`; on
failure it prints field errors and exits). Required with no default: `MONGO_URL`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (16+ chars), `USER_SECRETS_KEY` (32+ chars;
AES-256-GCM key for per-user LLM API keys — rotating it invalidates every stored
key). Optional: `SMTP_URL` (without it, magic links are printed to stdout),
`GOOGLE_OAUTH_CLIENT_ID` (comma-separated allowlist of the web and iOS client ids — Google
tokens carry the audience of the client that requested them), `VITE_GOOGLE_CLIENT_ID` (the
web one), `APPLE_CLIENT_ID`, S3 creds.

**There is no server-wide LLM API key.** Each account picks a provider in Settings
(Anthropic, OpenAI, Gemini, DeepSeek, Qwen, Kimi, or any OpenAI-compatible endpoint) and
stores its own keys, one per provider; summarization fails with `llm_not_configured` until
the active provider has one. `SUMMARIZER_MODEL` (default `claude-haiku-4-5`, undated — never
append date suffixes to Claude model ids) is only the Anthropic default; other defaults live
in `packages/shared/src/llm.ts` and every model is overridable per account.

Compose overrides `MONGO_URL` and `LADDER_URL` to container hostnames. Note the code
default for `LADDER_URL` is port 8080 while compose/.env.example use 8190 — trust `.env`.

## Building, checking, testing

```bash
pnpm --filter @a-rss/shared build   # ALWAYS after touching packages/shared/src (outside Docker)
pnpm --filter @a-rss/api build      # tsc — the API's typecheck
pnpm --filter @a-rss/web build      # tsc -b + vite build
pnpm build                          # all three in dependency order
pnpm --filter @a-rss/api test       # vitest, apps/api/test/*.test.ts
pnpm --filter @a-rss/web test       # Node unit tests for audio and binary API transport
```

`@a-rss/shared` is consumed as `dist/`, not source. Inside Docker its `tsc --watch`
handles rebuilds; outside, a stale dist means api/web silently typecheck against old
types. If a shared change "doesn't take", rebuild shared first.

**`pnpm lint` is broken** — the scripts reference ESLint but no config or binary
exists. Don't run it, don't "fix" it as a side effect; `tsc` is the safety net.

Tests: six pure-function suites in `apps/api/test/` (feed cursors, fetcher strategy
ladder, image URLs, OPML, poll interval adaptation, tokens). None touch Mongo, no
supertest. Web playback and binary transport have Node-only Vitest tests in apps/web/test/. `test/setup.ts` seeds every env var `env.ts` requires; if you
add a required var to `env.ts`, add it there too or every suite that imports `env`
exits mid-run.

### UI verification is the developer's job — never the agent's

**Under no circumstance should an agent build, run, simulate, or visually test the UI of
either client.** Concretely, do not: start the Docker stack or `pnpm dev` to open the web
app, drive http://localhost:8088 in a browser, run Playwright or any browser automation,
boot or install onto an iOS simulator or device, run `xcodebuild build`/`run` for the app,
run the `aRSSUITests` target, take screenshots, or otherwise exercise screens. The
developer does that part.

What *is* fine, and expected: type-checking (`pnpm build`, which compiles shared → api →
web), API unit tests (`pnpm --filter @a-rss/api test`), and iOS unit tests
(`xcodebuild test -only-testing:aRSSTests`, which compiles the app target as a side effect
— that is acceptable; launching it is not). When a change is user-visible, say plainly in
your report which flows you could not verify and what the developer should click through.

## Architecture

### API request flow

`routes/index.ts` mounts feature routers; each does `router.use(requireAuth)` once and
maps paths to bare controller references. Controllers are `RequestHandler` consts with
the same three-line preamble: `getUserId(req)`, `someRequest.parse(req.body)` (Zod
schema from `@a-rss/shared`, parsed in the controller, not middleware), and
`mongoose.isValidObjectId` → `HttpError(404)`. Authorization is done by folding `userId`
into every Mongo filter — there is no separate ACL layer, so never query a
user-owned collection without it.

Exception: `routes/me.ts` inlines its handlers. Don't spread that pattern.

`express-async-errors` is imported at the top of `index.ts` and must precede router
creation. It's why controllers can `throw` from async functions with no try/catch.
Removing or reordering that import silently breaks all error handling.

### Errors — one convention

Throw `HttpError(status, code, message?, retryable = false)` from
`middleware/errors.ts`. `errorHandler` emits `{ error, message, retryable }`
(`ApiErrorBody` in shared). `retryable` means "the same request might succeed if
re-sent" (rate limit, upstream timeout) vs. a durable condition (bad input, missing
config). Unclassified 5xx are treated as retryable, 4xx as not. The summarizer maps
vendor errors (Anthropic SDK classes, OpenAI-compatible HTTP statuses) onto `SummarizeErrorCode` (shared) and the controller turns
those into 503 (retryable) or 422. The web client's `api()` parses this into `ApiError`
with `.code/.message/.retryable`; UI shows `.message` and gates retry buttons on
`.retryable`. Known gap: Zod failures return `validation_error` with `details` but no
`message`.

### Auth

Access token: JWT `{ sub }`, HS256, 15 min, `Authorization: Bearer` only. Refresh
token: opaque 32 random bytes, SHA-256 hash stored in `AuthToken`, delivered as httpOnly
cookie `arss_refresh` scoped to `path=/api/v1/auth`, rotated on every refresh. Every
`/auth/*` credential endpoint has a 10/min rate limit on top of the global 300/min.
Passwords are argon2id. Google via `google-auth-library`, Apple via `jose` JWKS. Magic
link auto-creates users. The web client keeps the access token in a module variable in
`lib/api.ts` (never localStorage); a reload always does refresh → `/me`. iOS does the
same with `HTTPCookieStorage`.

### Data model and entry lifecycle

Models: `User`, `Source` (unique per `{userId, feedUrl}`), `Entry` (unique per
`{sourceId, guid}`), `Category`, `ReadReceipt`, `AuthToken` (TTL index). All use
`timestamps: true` except ReadReceipt. No `toJSON` transforms — `services/serializers.ts`
is the only place a Mongoose doc becomes an API shape; add fields there, not ad hoc.

`Entry.processingState`: `pending → fetched → summarized`, or `→ failed`.

- `pollSource` inserts `pending` via `$setOnInsert` upsert (idempotent), stores feed HTML in
  `rawHtml`, and sets `image` from the feed item itself (`services/feedImage.ts`: Media RSS,
  enclosure, or first plausible `<img>`; tagged `source: 'inline'`) so the card has an
  illustration immediately. Existing entries with `image: null` adopt it on later polls.
- `processEntry` runs the fetch chain → `fetched`. The page's `og:image` replaces an
  `inline` image (tagged `og`); if the page has none, the inline image stays. The winner is
  cached to MinIO/S3. On total failure, falls back to `rawHtml` if long enough
  (`error = "feed_fallback: …"`), else `failed`.
- `POST /entries/:id/summarize` is the only server-side path that calls a model →
  `summarized`. Summarization is deliberately not in the background pipeline: spend is
  bounded by reader interest, not feed volume. `PUT /entries/:id/summary` is the second
  path: a client-produced summary (iOS on-device Apple Foundation Models), stored once and
  never overwritten.
- `POST /entries/:id/retry` resets to `pending`.
- `POST /entries/:id/dismiss` sets `dismissedAt`. The document stays (deleting it would let
  the next poll's upsert resurrect the article) but it leaves the feed, the unread counts
  and diagnostics: `buildBaseFilter`, the unread-counts aggregation in `controllers/feeds.ts`
  and `listFailures` all filter `dismissedAt: null`. Add that filter to any new entry query.
- `GET /entries/failures` is keyset-paged like the feed (`limit` ≤ 100, default 20;
  `cursor` = base64url `updatedAtISO|id`, sorted `updatedAt` desc) and returns
  `{ items, nextCursor }`. Both Settings screens keep Diagnostics collapsed and only fetch
  the first page when the user expands it.

Fetch-pipeline failures (`failed`, `entry.error`, `retryEntry`) and summarization
failures (summary null, re-invoke summarize) are separate failure modes with separate
retry paths. Don't conflate them. Once `entry.summary` is set it's never re-requested.

Read state: writes are scoped to a `feedContext`, reads ignore it. Read the docblock in
`controllers/feeds.ts` before touching it. Feed pagination is keyset cursors
(`feedQuery.ts`, base64url `iso|id`), never offset.

### Background jobs (Agenda)

Wiring lives only in `services/agendaService.ts`; `jobs/pollSource.ts` and
`jobs/processEntry.ts` are plain async functions (so they're callable from controllers
and testable). `poll-source` (concurrency 4) does conditional GETs with ETag/Last-Modified
and adapts the interval between 5 and 60 minutes; scheduling cancels-then-`every()`s so
it's idempotent. `process-entry` (concurrency 2) retries with [5, 30] minute backoff, max
3. On boot, pending entries are re-enqueued.

### Fetch chain and paywalls

`services/fetcher.ts` walks `PAYWALL_STRATEGIES` (default `ladder,googlebot,wayback,
archive_ph`), per-source overridable via `Source.bypassStrategy`. Each attempt runs
Readability and is rejected under 500 chars, so a paywall stub falls through to the
next strategy. Ladder is a self-hosted proxy; the target URL is appended unencoded on
purpose (see the comment). FlareSolverr is wired to Ladder in compose, not to Node.

### Summarizer (`services/llm/`)

`resolveProvider(user)` turns the account's `llm` settings into a `ResolvedProvider`
(decrypted key, model, base URL with defaults) or throws `llm_not_configured`; `summarize()`
picks an adapter by protocol and applies the single retry rule (once on upstream 5xx or an
unparseable answer), then `classifyError` maps vendor failures onto `SummarizeErrorCode` with
the provider's name in the message. Two adapters:

- `anthropic.ts` — the official SDK. The long system prompt goes in a `cache_control:
  ephemeral` block and the article in the user turn so the cached prefix stays stable.
- `openaiCompatible.ts` — plain `fetch` to `${baseUrl}/chat/completions` for everyone else
  (OpenAI, Gemini's compat endpoint, DeepSeek, Qwen, Kimi, custom). Lowest common
  denominator on purpose: `max_tokens` only, no `temperature`, no `response_format`; one
  transparent re-issue with `max_completion_tokens` when a vendor insists. Status mapping
  handles Gemini's 400-for-bad-key and 402 billing errors; `TimeoutError`/`AbortError` →
  `timeout`, fetch `TypeError` → `connection_error`.

`prompt.ts` holds `SYSTEM_PROMPT`, `buildUserMessage` and `parseSummaryOutput`. **Treat the
prompt as append-only** — reformatting or reordering it busts Anthropic's cache for every
user. Local OpenAI-compatible servers need a context window ≥ 8192 tokens (Ollama:
`OLLAMA_CONTEXT_LENGTH`), or the prompt is silently truncated and surfaces as
`invalid_response`. User-supplied base URLs are normalized and link-local metadata hosts
refused (`normalizeBaseUrl`). Per-provider credentials live on `User.llm.credentials` (a Map);
`startupMigrations.ts` moved the old `anthropicApiKeyEnc` there on boot.

### Web client

- Routing: `react-router-dom` 7, table in `App.tsx`. One pathless route wraps
  `RequireAuth` + `Layout`. Feed views are `all`, `category:<id>`, `source:<id>`.
- Stores: plain `create()`, no middleware. `auth` (status/me), `feed`, `sources`
  (+ unread counts), `theme`. The only localStorage key is `arss-theme`.
- **Feed list never shifts under the reader.** `feed.refresh()` merges background
  results into existing entries in place (preserving local `isRead` and loaded
  `summary`) and parks genuinely new entries in `pendingEntries`; the pill in `Feed.tsx`
  calls `commitPending()`. Keep it that way.
- Summarization triggers on card expand when `!summary && processingState === 'fetched'`.
  `EntryCard`'s two effects in `Feed.tsx` (auto-mark-read on collapse, fallback body
  fetch) carry long comments and intentional lint-disables. Read them before "fixing"
  dependency arrays.
- Errors: inline `role="alert"` for page/form errors, `toast.error(err.message)` for
  background/optimistic failures, inline-in-card with a retry button only when
  `retryable` for summarize.
- Theming: RGB-channel CSS variables in `styles/index.css` mapped in
  `tailwind.config.js` (`paper`, `ink`, `muted`, `rule`, `vermilion`, …). Dark mode is
  the `.dark` class swapping variables — `darkMode: 'class'` is **not** set and no
  `dark:` utilities exist; don't introduce them, use the tokens. Three files must stay
  in sync: `index.css` palette, `stores/theme.ts` maps, `index.html` pre-paint script
  and `<link id=…>` tags.
- Look: "newspaper" — Fraunces display, Geist body, JetBrains Mono, sharp corners, 2px
  ink rules, vermilion accent, unicode glyphs/inline SVG instead of an icon library.
  No component library. Match it.
- No `dangerouslySetInnerHTML` anywhere; React escapes everything. Titles arrive
  already HTML-decoded from the API (`entities` in `pollSource.ts`) — never
  double-decode or inject as HTML.
- Only `VITE_*` vars reach the browser. API base is the relative `/api/v1` via the
  Vite proxy.

### Shared package

`packages/shared/src`: `auth.ts`, `entries.ts`, `sources.ts`, `feeds.ts`, `llm.ts` (the
provider catalog — labels, protocols, default hosts/models — plus the settings and
client-summary schemas; the API decorates it with per-user state in `/me`), `common.ts`,
`errors.ts`. Every wire shape is a Zod schema with a `z.infer` type next to it. The API
parses with the schemas; the web imports only the types (`import type`). When you add
or change an API field: schema first, rebuild shared, then serializer, then UI, then the
matching Swift DTO. `PATCH /sources/:id` accepts `categoryId: null` to un-assign a category
(added for iOS; the web's "Uncategorized" option still sends `{}` and is a known bug).

### iOS

Native SwiftUI client that mirrors the web client's behavior 1:1 (same stores, rules, API
calls and copy), built for iOS 26 with Swift 6 strict concurrency and Liquid Glass. It also
runs on macOS as a **Mac Catalyst** app (`TARGETED_DEVICE_FAMILY 1,2,6`, "Designed for iPad"
off): the Mac build uses `aRSS/aRSS-macCatalyst.entitlements` (app sandbox + network client +
user-selected files) via `CODE_SIGN_ENTITLEMENTS[sdk=macosx*]`, while iOS keeps
`aRSS.entitlements` — iOS provisioning rejects macOS sandbox keys, so never merge the two. Layout in
`ios/aRSS`: `App/` (entry, composition root, root view, deep links), `Networking/` (`APIClient`
actor, `Endpoints`, `ARSSAPI` protocol + `LiveARSSAPI`, DTOs), `Stores/` (`@Observable`
Auth/Feed/Sources/Theme/Toast), `Navigation/` (split view on iPad, tabs on iPhone), `Views/`,
`Theme/`, `Components/`, `Utilities/`. Unit tests in `ios/aRSSTests` (Swift Testing). The
`ios/aRSSUITests` smoke test drives the real app against a running API and is **for the
developer only** — agents never run it (see "UI verification is the developer's job").

```bash
cd ios && ./scripts/generate.sh        # xcodegen + pin SwiftPM deps from ios/Package.resolved
# Agents: unit tests only.
xcodebuild -project aRSS.xcodeproj -scheme aRSS -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:aRSSTests test
# Same on macOS (Catalyst); -allowProvisioningUpdates lets Xcode create the Catalyst profile once.
xcodebuild -project aRSS.xcodeproj -scheme aRSS -destination 'platform=macOS,variant=Mac Catalyst' -only-testing:aRSSTests -allowProvisioningUpdates test
# Developer only — end-to-end smoke (Docker stack up, an existing account):
TEST_RUNNER_SMOKE_EMAIL=… TEST_RUNNER_SMOKE_PASSWORD=… xcodebuild … -only-testing:aRSSUITests test
```

- **Run `scripts/generate.sh` after adding or removing Swift files** — XcodeGen snapshots the
  file list, so a new file is invisible to `xcodebuild` until you regenerate.
- **Default MainActor isolation is on** (`SWIFT_DEFAULT_ACTOR_ISOLATION`). Views, stores and
  services are main-actor by default; everything in `Networking/` (DTOs, `APIError`,
  `APIRequest`, the `ARSSAPI` protocol and its extensions) is explicitly `nonisolated` so the
  `APIClient` actor can use it. New DTOs must follow suit or decoding won't compile.
- **DTOs mirror `packages/shared/src/*.ts` by hand** (header comment in each `DTOs+*.swift`).
  When a shared schema changes, update the matching Swift struct. String enums adopt
  `TolerantEnum` so unknown server values decode to `.unknown` instead of failing the payload.
- **Summarization goes through `SummarizationService`** (`Summarizing` protocol), which uses
  the account's cloud provider or, when the per-device `SummarizationPreferences.onDevice`
  switch is on and Apple Intelligence is available, `FoundationModelsSummarizer` — then
  uploads the result via `PUT /entries/:id/summary`. The engine hides behind
  `OnDeviceSummarizing` and is never instantiated in unit tests; refusals fall back to the
  cloud when one is configured. Settings has an "AI provider" section (driven entirely by
  `/me`) and an "On this device" toggle.
- **Read aloud** (`Services/SpeechReader.swift`, web `lib/readAloud.ts`): the card reads the AI
  summary it shows (else the fallback body); the detail page reads the full article (else the
  summary). `ReadAloudScript` builds the spoken text and is the unit-tested part; one read at a
  time, and the button stops its own read when it leaves the screen. ElevenLabs is selected
  per account in Settings; `/me/speech` stores the encrypted key and voice/model IDs,
  `/speech` proxies bounded MP3 generation. The same native player handles CarPlay and
  system media commands. CarPlay uses a separate title-only library and summary queue,
  never a full-article fallback. See `docs/read-aloud-and-carplay.md` for setup, Apple's
  entitlement requirement and the developer's manual checks.
- **Stores depend on the `ARSSAPI` protocol**, never on `APIClient` directly; tests inject
  `FakeARSSAPI`. `FeedStore` is a line-by-line port of `apps/web/src/stores/feed.ts` — change
  both or neither.
- **Session**: access token in memory inside the actor; the refresh cookie lives in
  `HTTPCookieStorage.shared` and restores the session on launch. `RefreshCookieVault` mirrors
  that one cookie into the Keychain after every auth response because the server rotates it
  on each refresh and the cookie store flushes lazily — an abrupt kill right after a refresh
  otherwise loses the session. Nothing else belongs in the Keychain.
- **Config**: `ARSS_API_BASE_URL` (default `https://api.a-rss.com/api/v1`),
  `GOOGLE_CLIENT_ID` / `GOOGLE_REVERSED_CLIENT_ID` and `DEVELOPMENT_TEAM` live in
  `ios/Defaults.xcconfig` (checked in), which `#include?`s the gitignored `ios/Local.xcconfig`
  last — put per-developer values there (e.g. `http://localhost:5088/api/v1` for the Docker
  stack; see `Local.xcconfig.example`). Never define these under `settings:` in project.yml:
  Xcode's project/target settings override xcconfig values, which silently disables overrides. The Google button hides
  itself when the id is empty. Magic links arrive as `arss://auth/magic?t=…` or a pasted web link.
- **Liquid Glass is used sparingly**: system toolbars/tab bar, the glass sidebar
  (`NavigationSplitView` + `List(selection:)`, so macOS 26 and iPadOS give it the system
  treatment and selection highlight), the "N new" pill, toasts, and primary CTAs. Cards and
  rows are opaque paper surfaces on purpose.
- **Mac idioms on Catalyst**: SwiftUI `.toolbar` items render *inside the content* on
  Catalyst, never in the window's title bar, so `Navigation/MacToolbar.swift` installs a real
  `NSToolbar` on the `UITitlebar` (unified style, one row aligned with the traffic lights):
  wordmark (`NSUIViewToolbarItem` hosting the SwiftUI `Wordmark`; swapped for a logo-only item
  when `LayoutMetrics.sidebarWidth`, reported by `SidebarView`, drops below 250 pt — `minSize`
  is unavailable on Catalyst), theme and Settings (hosted SwiftUI views, so the sun/moon follows
  the window's real appearance) beside it, `.primarySidebarTrackingSeparatorItemIdentifier`, then All/Unread
  (`NSToolbarItemGroup`), New/Old, Fetch and Mark read (`NSMenuToolbarItem`) over the content;
  the feed scope and unread count are the window title/subtitle. It mirrors store state with
  `withObservationTracking` and exists only while signed in. On the Mac the SwiftUI toolbars and
  the root navigation bars are hidden (`#if targetEnvironment(macCatalyst)`); iPhone/iPad keep
  them. The sidebar is a real selectable list (so, unlike the web, re-clicking the active scope
  doesn't reload — ⌘R fetches, pull-to-refresh reloads), ⌘, opens Settings, tap targets carry
  `.hoverEffect`, and the wordmark shows its name only when it fits whole (`ViewThatFits`).
  Articles span the full content width in every layout.
- Stable Xcode needs the simulator runtime matching its SDK installed (Xcode › Settings ›
  Components, or `xcodebuild -downloadPlatform iOS`) before it will offer any destination.
- Catalyst test signing: XcodeGen's iOS unit-test preset sets `CODE_SIGN_IDENTITY[sdk=macosx*] = "-"`
  (ad-hoc). With a team-signed host app, macOS then refuses to load the bundle ("different Team
  IDs"), so both test targets override it to `Apple Development` in project.yml. Don't pass
  `CODE_SIGNING_ALLOWED=NO` to a Catalyst build either — it leaves an unsigned bundle that
  incremental builds reuse until a `clean`. A new Catalyst bundle id needs one run with
  `-allowProvisioningUpdates`.

## Conventions

- ESM everywhere; relative imports in the API carry `.js` extensions even for `.ts`
  sources. Web uses the `@/` alias for everything internal. `import type` for types.
- Explicit return types on exported functions. Numeric separators (`60_000`). Verb
  prefixes: `serializeX`, `buildX`, `parseX`, `fetchX`. Fire-and-forget promises are
  marked `void promise()`. Error narrowing idiom: `err instanceof Error ? err.message : '…'`.
- Logging is pino via `services/logger.ts`, request logs via pino-http with
  `x-request-id` propagation. No `console.log` in new API code.
- Comments explain *why*, in sentence-case prose above the code, and here they are
  load-bearing (Ladder no-encode, express-async-errors ordering, route order in
  `routes/sources.ts`, read-state semantics, theme file coupling). When you rely on an
  invariant that isn't obvious from the code, write it down the same way.
- Idempotency by default: `$setOnInsert` upserts, cancel-then-schedule jobs,
  conditional GETs. New write paths should survive being run twice.
- Accessibility is real here: `role="alert"/"status"`, `aria-*` on controls,
  `aria-hidden` on decorative glyphs, labels on inputs, global focus-visible ring,
  keyboard shortcuts (`j/k/m/f/o`) in the feed. Keep new UI at that bar.
- Commit messages: short one-line subject, sentence case, no prefixes.

## How to work here

**Before changing anything**, read the file's comments and the nearest test. Most
surprising code in this repo is deliberate and says so.

**Never verify UI yourself.** Type-check and run unit tests; leave building, running,
simulating and looking at either client to the developer (details above).

**Think in the whole stack.** A schema field is a shared change + rebuild + serializer
+ web type + DTOs.swift check. An error is a code in shared + `HttpError` + UI message
+ `retryable` decision. Do all the parts, or say which you left out and why.

**Prefer existing seams over new ones.** New HTTP behavior goes in a controller, new
logic in a service, new wire shapes in shared. Don't add a dependency when the stdlib
or an existing one does the job; `cheerio` and `xmlbuilder2` are already unused
baggage — don't add more.

**Keep decisions local and reversible.** Small functions with explicit types, one error
convention, no clever abstractions for one call site. If a second call site appears,
then extract.

**Errors are product surface.** Every failure a user can hit needs a stable code, a
message that reads correctly verbatim in the UI, and an honest `retryable`.

**Definition of done** for a change:
1. `pnpm build` passes (shared → api → web), `pnpm --filter @a-rss/api test` passes, and
   for iOS changes `xcodebuild test -only-testing:aRSSTests` passes.
2. You did **not** build, run, simulate, or visually test the UI. For user-visible changes
   your report names the flows the developer should verify by hand.
3. Nothing was reformatted that didn't need to be (especially the summarizer prompt).
4. Comments were updated where an invariant moved.
5. Warts you noticed but didn't fix are reported, not silently fixed or ignored.

## Known warts (report, don't silently fix)

- `ruleset.yaml` and `handlers/form.html` at the repo root are empty **directories**
  Docker created because compose bind-mounts files that don't exist. Ladder runs with
  no ruleset. Git ignores empty dirs, so status looks clean.
- `apps/web/dist-node/*` and `apps/web/tsconfig.tsbuildinfo` are tracked build
  artifacts; `pnpm build` dirties the tree.
- `feed.pollFeed()` sleeps a hardcoded 4 s waiting for Agenda instead of polling for a signal.
- `POST /sources/:id/refresh` runs the poll synchronously in the request (bulk refresh enqueues).
- `getFeed` loads every entry id in the view per page request. Fine at personal scale, O(n).
- Deleting a source cascades entries but orphans its `ReadReceipt` rows.
- Access tokens aren't revoked on password change (15 min exposure).
- `exportOpmlBlob` in `Sources.tsx` bypasses the api client (no 401 retry, `alert()` on failure).
- `EntryDetail.tsx` swallows summarize errors; `Feed.tsx` surfaces them. Inconsistent.
- `subscribeToAccessToken` in `lib/api.ts` and `RequireAuth`'s `state.from` are dead code.
- `logo.png`/`logo_dark.png` in `apps/web/public` are unreferenced since the touch icon moved to `apple-touch-icon.png`.
