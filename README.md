# a-RSS - another RSS Software Solution

A modern, self-hosted RSS feed reader with a clean interface and powerful features. Built with a full-stack TypeScript monorepo architecture.

**[Live Demo](https://arss.jezzlucena.com)** | **[Landing Page](https://arss-hub.jezzlucena.com)**

## Features

- **Feed Management** - Subscribe to RSS/Atom feeds, organize into hierarchical categories, custom titles per subscription
- **Article Reading** - Multiple layouts (compact, list, cards, magazine), mark as read/unread, save for later
- **Full-Text Search** - PostgreSQL full-text search across all your articles with suggestions
- **OPML Support** - Import and export your feeds for easy migration
- **Customization** - Light/dark/system themes, accent colors, adjustable font sizes, multiple view modes
- **Background Sync** - Automatic feed refresh with BullMQ job queue processing
- **Internationalization** - English, Portuguese (Brazil), and Spanish language support
- **Security** - JWT authentication, rate limiting, CORS protection, security headers

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Zustand, TanStack Query, Tailwind CSS, Radix UI, Framer Motion |
| **Backend** | Node.js 20+, Express, TypeScript, Drizzle ORM, Zod |
| **Database** | PostgreSQL 16 |
| **Cache/Queue** | Redis 7, BullMQ |
| **Build** | pnpm workspaces, Turborepo |
| **Infrastructure** | Docker, Nginx, GitHub Actions |

## Project Structure

```
a-RSS/
├── apps/
│   ├── api/                 # Express backend API
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── db/          # Database schema & migrations
│   │   │   ├── middleware/  # Auth, security, validation
│   │   │   ├── jobs/        # Background job processors
│   │   │   ├── config/      # Environment configuration
│   │   │   ├── lib/         # Logger, route helpers
│   │   │   └── docs/        # OpenAPI spec generator
│   │   └── Dockerfile
│   └── web/                 # React frontend SPA
│       ├── src/
│       │   ├── components/  # UI components
│       │   ├── pages/       # Route pages
│       │   ├── stores/      # Zustand state stores
│       │   ├── hooks/       # Custom React hooks
│       │   ├── lib/         # Utilities and API client
│       │   └── i18n/        # Internationalization
│       ├── nginx.conf
│       └── Dockerfile
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── constants/           # Shared application constants
│   ├── schemas/             # Zod validation schemas
│   └── utils/               # Shared utility functions
├── docs/
│   └── API.md               # API documentation
├── docker-compose.yml       # Docker services (profiles: infra, app)
└── .env.example             # Environment variables template
```

## Prerequisites

- Node.js 20+
- pnpm 9.15.4+
- Docker & Docker Compose

## Quick Start

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/jezzlucena/a-RSS.git
   cd a-RSS
   pnpm install
   ```

2. **Generate and run database migrations (only needed once)**
   ```bash
   pnpm run db:generate && pnpm run db:migrate
   ```

3. **Start development server**
   ```bash
   pnpm run docker:infra && pnpm run dev
   ```

   - Web: http://localhost:8088
   - API: http://localhost:5058
   - API Docs: http://localhost:5058/api/docs

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all packages for production |
| `pnpm lint` | Run ESLint across the monorepo |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run test suite |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |
| `pnpm clean` | Remove build artifacts and node_modules |

### Docker Scripts

| Script | Description |
|--------|-------------|
| `pnpm docker:infra` | Start infrastructure services (PostgreSQL, Redis) |
| `pnpm docker:infra:down` | Stop infrastructure services |
| `pnpm docker:infra:logs` | View infrastructure service logs |
| `pnpm docker:prod:build` | Build production Docker images |
| `pnpm docker:prod:up` | Start full production stack |
| `pnpm docker:prod:down` | Stop production stack |
| `pnpm docker:prod:logs` | View production logs |

## Production Deployment

1. **Create environment file**
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables** (see below)

3. **Build and start production services**
   ```bash
   pnpm run docker:prod:build && pnpm run docker:prod:up
   ```

   The production stack runs:
   - Web: http://localhost:8088
   - API: http://localhost:5058 (proxied via Nginx at `/api`)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL username | `arss` |
| `POSTGRES_PASSWORD` | PostgreSQL password | - |
| `POSTGRES_DB` | PostgreSQL database name | `arss` |
| `REDIS_PASSWORD` | Redis password | - |
| `JWT_SECRET` | JWT signing secret (min 32 characters) | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (min 32 characters) | - |
| `CORS_ORIGIN` | Allowed CORS origin (no trailing slash) | `http://localhost:8088` |
| `API_PORT` | API server port | `5058` |
| `WEB_PORT` | Web server port | `8088` |

## API Documentation

Interactive API documentation (Swagger UI) is available at `/api/docs` when the API server is running.

For detailed API reference, see [docs/API.md](./docs/API.md).

### Main Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/*` | Authentication (register, login, refresh, logout) |
| `GET/POST /api/v1/feeds/*` | Feed subscription management |
| `GET/PATCH /api/v1/articles/*` | Article retrieval and state |
| `GET/POST/PATCH/DELETE /api/v1/categories/*` | Category management |
| `GET/PATCH /api/v1/preferences` | User preferences |
| `POST /api/v1/preferences/import` | Import OPML |
| `GET /api/v1/preferences/export` | Export OPML |
| `GET /api/v1/search` | Full-text article search |
| `GET /health` | Health check |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Setting up your development environment
- Code style and guidelines
- Submitting pull requests
- Reporting bugs and requesting features

## Support

If you find this project useful, consider [sponsoring the development](https://github.com/sponsors/jezzlucena).

## License

MIT
