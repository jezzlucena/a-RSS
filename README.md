# aRSS - another RSS Software Solution

A modern, self-hosted RSS feed reader with a clean interface and powerful features. Built with a full-stack TypeScript monorepo architecture.

## Features

- **Feed Management** - Subscribe to RSS feeds, organize into hierarchical categories, custom titles per subscription
- **Article Reading** - Multiple layouts (compact, list, cards, magazine), mark as read/unread, save for later
- **Full-Text Search** - Search across all your articles
- **OPML Support** - Import and export your feeds for easy migration
- **Customization** - Light/dark/system themes, accent colors, adjustable font sizes, multiple view modes
- **Background Sync** - Automatic feed refresh with job queue processing

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Zustand, TanStack Query, Tailwind CSS, Radix UI |
| **Backend** | Node.js, Express, TypeScript, Drizzle ORM, Zod |
| **Database** | PostgreSQL 16 |
| **Cache/Queue** | Redis 7, BullMQ |
| **Build** | pnpm workspaces, Turborepo |
| **Infrastructure** | Docker, Nginx, GitHub Actions |

## Project Structure

```
aRSS/
├── apps/
│   ├── api/                 # Express backend API
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── db/          # Database schema & migrations
│   │   │   ├── middleware/  # Auth, security, validation
│   │   │   └── workers/     # Background job processors
│   │   └── Dockerfile
│   └── web/                 # React frontend SPA
│       ├── src/
│       │   ├── components/  # UI components
│       │   ├── pages/       # Route pages
│       │   ├── stores/      # Zustand state stores
│       │   ├── hooks/       # Custom React hooks
│       │   └── lib/         # Utilities and API client
│       └── Dockerfile
├── packages/
│   ├── types/               # Shared TypeScript types
│   └── utils/               # Shared utility functions
├── docker-compose.yml       # Development services
└── docker-compose.prod.yml  # Production deployment
```

## Prerequisites

- Node.js 20+
- pnpm 9.15.4+
- Docker & Docker Compose

## Development Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd aRSS
   pnpm install
   ```

2. **Start database and cache services**
   ```bash
   pnpm docker:up
   ```

3. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

4. **Start development servers**
   ```bash
   pnpm dev
   ```

   - API: http://localhost:3000
   - Web: http://localhost:5173
   - API Docs: http://localhost:3000/api/docs

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
| `pnpm docker:up` | Start development services (PostgreSQL, Redis) |
| `pnpm docker:down` | Stop development services |
| `pnpm docker:logs` | View development service logs |
| `pnpm docker:prod:build` | Build production Docker images |
| `pnpm docker:prod:up` | Start production stack |
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
   pnpm docker:prod:build
   pnpm docker:prod:up
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `REDIS_PASSWORD` | Redis password |
| `JWT_SECRET` | JWT signing secret (min 32 characters) |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (min 32 characters) |
| `CORS_ORIGIN` | Allowed CORS origin (e.g., `https://your-domain.com`) |
| `WEB_PORT` | Web server port (default: 80) |

## API Documentation

Interactive API documentation is available at `/api/docs` when the API server is running.

For detailed API reference, see [docs/API.md](./docs/API.md).

### Main Endpoints

- `POST /api/v1/auth/*` - Authentication (register, login, refresh)
- `GET/POST /api/v1/feeds/*` - Feed subscription management
- `GET/PATCH /api/v1/articles/*` - Article retrieval and state
- `GET/POST/PATCH/DELETE /api/v1/categories/*` - Category management
- `GET/PATCH /api/v1/preferences` - User preferences
- `GET /api/v1/search` - Full-text article search

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
