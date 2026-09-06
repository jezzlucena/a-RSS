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
ios/              SwiftUI client. XcodeGen project.yml is the source of truth;
                  aRSS.xcodeproj is gitignored/generated. Not in the pnpm workspace.
docker-compose.yml  mongo, minio, ladder, flaresolverr, and the `dev` container
.env.example      Every env var, grouped and commented. Copy to .env.
```

`apps/api/src`: `routes/` (thin routers) → `controllers/` (parse, authorize, query,
serialize) → `services/` (everything non-HTTP) and `models/` (Mongoose). `jobs/` holds
Agenda job bodies that know nothing about Agenda. `middleware/` has `requireAuth` and
the `HttpError`/`errorHandler` pair. `config/env.ts` is the only file that reads
`process.env`.

`apps/web/src`: `pages/` (one default-exported component per route), `components/`
(only Layout, RequireAuth, GoogleButton — named exports), `stores/` (Zustand),
`lib/` (`api.ts` fetch client, `timeAgo.ts`), `styles/index.css` (palette tokens).
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
AES-256-GCM key for per-user Anthropic keys — rotating it invalidates every stored
key). Optional: `SMTP_URL` (without it, magic links are printed to stdout),
`GOOGLE_OAUTH_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` (must match), `APPLE_CLIENT_ID`, S3 creds.

**There is no server-wide Anthropic API key.** Each user sets their own in Settings;
summarization fails with `anthropic_api_key_missing` until they do. `SUMMARIZER_MODEL`
defaults to `claude-haiku-4-5-20251001`.

Compose overrides `MONGO_URL` and `LADDER_URL` to container hostnames. Note the code
default for `LADDER_URL` is port 8080 while compose/.env.example use 8190 — trust `.env`.

## Building, checking, testing

```bash
pnpm --filter @a-rss/shared build   # ALWAYS after touching packages/shared/src (outside Docker)
pnpm --filter @a-rss/api build      # tsc — the API's typecheck
pnpm --filter @a-rss/web build      # tsc -b + vite build
pnpm build                          # all three in dependency order
pnpm --filter @a-rss/api test       # vitest, apps/api/test/*.test.ts
```

`@a-rss/shared` is consumed as `dist/`, not source. Inside Docker its `tsc --watch`
handles rebuilds; outside, a stale dist means api/web silently typecheck against old
types. If a shared change "doesn't take", rebuild shared first.

**`pnpm lint` is broken** — the scripts reference ESLint but no config or binary
exists. Don't run it, don't "fix" it as a side effect; `tsc` is the safety net.

Tests: six pure-function suites in `apps/api/test/` (feed cursors, fetcher strategy
ladder, image URLs, OPML, poll interval adaptation, tokens). None touch Mongo, no
supertest, no web tests. `test/setup.ts` seeds every env var `env.ts` requires; if you
add a required var to `env.ts`, add it there too or every suite that imports `env`
exits mid-run.

### Verifying for real

Typecheck and tests don't prove a flow works. For anything a user touches, bring the
stack up and drive it: `POST /api/v1/auth/signup` with email/password (no SMTP needed),
then exercise the UI at http://localhost:8088. Say plainly what you did and didn't verify.

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
Anthropic SDK error classes onto `SummarizeErrorCode` (shared) and the controller turns
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
- `POST /entries/:id/summarize` is the **only** thing that calls Claude → `summarized`.
  Summarization is deliberately not in the background pipeline: spend is bounded by
  reader interest, not feed volume.
- `POST /entries/:id/retry` resets to `pending`.

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

### Summarizer

`services/summarizer.ts` builds a `new Anthropic({ apiKey })` per call from the user's
decrypted key. The long system prompt is sent with `cache_control: { type: 'ephemeral' }`
and the article in the user turn, so the cached prefix stays stable. **Treat the prompt
as append-only** — reformatting or reordering it busts the cache for every user. Output
is `{ intro, bullets: [3] }`, fence-stripped, JSON-parsed, Zod-validated, one retry on
5xx/parse failure.

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

`packages/shared/src`: `auth.ts`, `entries.ts`, `sources.ts`, `feeds.ts`, `common.ts`,
`errors.ts`. Every wire shape is a Zod schema with a `z.infer` type next to it. The API
parses with the schemas; the web imports only the types (`import type`). When you add
or change an API field: schema first, rebuild shared, then serializer, then UI.

### iOS

SwiftUI, iOS 17+, `actor APIClient` singleton, `@Observable` stores. `Networking/DTOs.swift`
hand-mirrors the shared schemas and has already drifted (missing `hasAnthropicApiKey`,
`apple` auth method, `Entry.error`). If you change a shared schema, check DTOs.swift.
Base URL comes from the `ARSS_API_BASE_URL` build setting in `project.yml`.

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
1. `pnpm build` passes (shared → api → web) and `pnpm --filter @a-rss/api test` passes.
2. The real flow was exercised in the Docker stack when the change is user-visible,
   or you state that it wasn't.
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
