# a-RSS

RSS reader that fetches articles from user-configured sources and summarizes each one
into an intro sentence + 3 bullets via Claude. pnpm monorepo: an Express/TypeScript API,
a React/Vite web client, a shared types package, and a native iOS app.

## Layout

```
apps/api       Express + TypeScript API (Mongoose/MongoDB, Agenda background jobs)
apps/web       React 19 + Vite + Zustand + Tailwind
packages/shared  Zod schemas + inferred types shared by api and web (built to dist/,
                 consumed as @a-rss/shared — rebuild it after changing its src/)
ios/           Native iOS client (Xcode project, not part of the pnpm workspace)
```

Inside `apps/api/src`: `routes/` → `controllers/` → `services/`, with `models/`
(Mongoose schemas), `jobs/` (Agenda job definitions for polling sources and processing
entries), and `middleware/` (auth, error handling). `errors.ts`'s `HttpError` is the
one error convention the API uses — throw it (or let express-async-errors catch a
rejection) rather than hand-rolling a response; `errorHandler` turns it into
`{ error, message, retryable }`.

## Running it — Docker is the default

```bash
docker compose up --build -d
```

This starts everything: MongoDB, MinIO (S3-compatible image cache), Ladder
(paywall-bypass proxy), FlareSolverr, and the `dev` container that runs both apps.
There's no custom Dockerfile — every service pulls a stock image, so `--build` is a
no-op today, but pass it anyway; it becomes load-bearing the moment anyone adds a
`build:` context, and it's harmless when there isn't one. The `dev` container's
`command:` does `pnpm install --frozen-lockfile && pnpm -r --parallel run dev` on every
`up`, so a fresh `docker compose up --build -d` after pulling new dependencies just
works — no separate install step.

- Web: http://localhost:8088 (proxied from the container's Vite dev server on 5173)
- API: http://localhost:5088 (container's Express server on 4000), mounted at `/api/v1`
- Mongo: localhost:27020 · MinIO console: localhost:9001 · Ladder: localhost:8190

Tail logs with `docker logs arss-dev -f` (both apps log to the same stream, prefixed
`apps/api dev:` / `apps/web dev:`). Source is bind-mounted from the repo root, so edits
on the host hot-reload inside the container immediately — you don't need to restart
anything for a code change, only for a new dependency or an env var change.

`node_modules` for the root and each workspace package are named volumes, not bind
mounts (see the `arss-dev-*-node-modules` volumes in `docker-compose.yml`) — this is
deliberate, so the container's own `pnpm install` always wins and a stale host
`node_modules` never shadows a newly added dependency. If dependencies get into a bad
state, `docker compose down` (add `-v` only if you actually want to wipe Mongo/MinIO
data too — ask before doing that on anyone else's stack) then `up --build -d` again.

### Without Docker

`pnpm install` then `pnpm dev` (or `pnpm dev:api` / `pnpm dev:web` individually) also
works, loading `.env` via `dotenv-cli`, but you're on your own for Mongo/MinIO/Ladder —
either point `.env` at already-running instances or start them separately. Prefer
Docker unless you have a specific reason not to.

## Environment

Config lives in a single root `.env` (gitignored). Copy `.env.example` to `.env` and
fill in the placeholders — `apps/api/src/config/env.ts` is the authoritative list of
what's required vs. defaulted if `.env.example` drifts. Notable required vars with no
default: `MONGO_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (both
16+ chars), `USER_SECRETS_KEY` (32+ chars — AES-256-GCM key encrypting per-user
Anthropic API keys at rest; rotating it invalidates every stored key). Note there is
**no server-wide Anthropic API key** — each user sets their own in Settings, encrypted
with `USER_SECRETS_KEY`; summarization fails with `anthropic_api_key_missing` until
they do.

## Building & checking

```bash
pnpm --filter @a-rss/shared build   # rebuild after touching packages/shared/src
pnpm --filter @a-rss/api build      # tsc typecheck + emit (apps/api/dist)
pnpm --filter @a-rss/web build      # tsc -b + vite build (apps/web/dist)
pnpm build                          # all three, in workspace dependency order
```

`packages/shared` is consumed as compiled output (`dist/`), not source — if you edit
a shared type and the api/web build doesn't pick it up, rebuild `@a-rss/shared` first.
Inside the Docker `dev` container this happens automatically (`shared`'s dev script is
`tsc --watch`); outside Docker, rebuild it manually.

There is no ESLint config in the repo yet, so `pnpm lint` isn't currently meaningful —
lean on `tsc` (via the build scripts above) for type safety.

## Tests

```bash
pnpm --filter @a-rss/api test    # vitest, apps/api/test/*.test.ts + colocated *.test.ts
pnpm --filter @a-rss/web test    # vitest (no web tests exist yet)
```

`apps/api/test/setup.ts` fills in the minimum env vars `config/env.ts` requires so
tests can run without a full `.env`. Tests don't spin up Mongo/MinIO themselves —
check a given test file before assuming it's fully isolated from external services.

## Verifying a change for real

Typecheck and tests confirm the code compiles and unit behavior holds — they don't
confirm a UI or end-to-end flow actually works. For anything touching the web app or
an API route a user hits directly, bring the stack up with `docker compose up --build -d`
and drive it for real: sign up a test account (`POST /api/v1/auth/signup` with an
email/password works without email delivery — magic-link and Google/Apple sign-in
need SMTP/OAuth configured), then exercise the flow in a browser at
http://localhost:8088.

## Conventions worth knowing

- **Error shape**: every API error response is `{ error: <code>, message: <string>,
  retryable: <boolean> }` (see `apps/api/src/middleware/errors.ts`). `retryable`
  distinguishes a transient failure (rate limited, upstream timeout — retrying the
  same request might work) from a durable one (missing config, bad input — it won't
  succeed until something changes). The frontend's `api()` client
  (`apps/web/src/lib/api.ts`) parses this into an `ApiError` with `.code`/`.message`/
  `.retryable`; surface `.message` and gate a retry affordance on `.retryable` rather
  than showing a generic failure string.
- **Summarization is per-entry and cached**: once `entry.summary` is set it's never
  re-requested; a fetched-but-unsummarized entry re-triggers Claude on every expand
  until it succeeds. Fetch-pipeline failures (`processingState: 'failed'`, tracked via
  `entry.error`) and summarization failures are separate failure modes with separate
  retry paths (`retryEntry` vs. re-invoking summarize) — don't conflate them.
- **Feed list updates avoid layout shift**: the feed store
  (`apps/web/src/stores/feed.ts`) merges background-refreshed entries into existing
  ones in place and stashes genuinely-new entries in `pendingEntries` rather than
  prepending them live, so the list never jumps under a reader mid-scroll. A pill in
  `Feed.tsx` lets the user pull them in explicitly via `commitPending`.
- **Prompt caching**: the summarizer's system prompt
  (`apps/api/src/services/summarizer.ts`) is long and deliberately stable so Anthropic
  prompt caching (`cache_control: { type: 'ephemeral' }`) applies — don't casually
  reformat or reorder it; treat it as append-only for new examples/rules.
