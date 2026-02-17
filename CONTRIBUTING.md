# Contributing to a-RSS

Thank you for your interest in contributing to a-RSS! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9.15+
- Docker & Docker Compose
- Git

### Development Setup

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/a-RSS.git
   cd a-RSS
   ```

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Start the database services**

   ```bash
   pnpm docker:up
   ```

5. **Run database migrations**

   ```bash
   pnpm db:migrate
   ```

6. **Start development servers**

   ```bash
   pnpm dev
   ```

   - API: http://localhost:3000
   - Web: http://localhost:5173
   - API Docs: http://localhost:3000/api/docs

## Project Structure

```
a-RSS/
├── apps/
│   ├── api/                 # Express backend API
│   │   ├── src/
│   │   │   ├── routes/      # API endpoint handlers
│   │   │   ├── services/    # Business logic
│   │   │   ├── db/          # Database schema & migrations
│   │   │   ├── middleware/  # Express middleware
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
├── docs/                    # Documentation
└── docker-compose.yml       # Development services
```

## How to Contribute

### Reporting Bugs

Before creating a bug report:

1. Check the [existing issues](https://github.com/jezzlucena/a-RSS/issues) to avoid duplicates
2. Update to the latest version to see if the bug persists

When creating a bug report, include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots (if applicable)
- Your environment (OS, Node version, browser)

### Suggesting Features

Feature requests are welcome! Please:

1. Check existing issues and discussions first
2. Provide a clear use case for the feature
3. Explain how it would benefit other users

### Pull Requests

1. **Create a branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**

   - Follow the existing code style
   - Write meaningful commit messages
   - Add tests for new functionality
   - Update documentation as needed

3. **Run checks locally**

   ```bash
   # Type checking
   pnpm typecheck

   # Linting
   pnpm lint

   # Tests (if applicable)
   pnpm test

   # Build
   pnpm build
   ```

4. **Commit your changes**

   Use conventional commit messages:

   ```
   feat: add new feature
   fix: resolve bug issue
   docs: update documentation
   style: format code
   refactor: restructure code
   test: add tests
   chore: update dependencies
   ```

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**

   - Fill out the PR template
   - Link any related issues
   - Request review from maintainers

## Development Guidelines

### Code Style

- **TypeScript:** Use strict typing, avoid `any`
- **React:** Functional components with hooks
- **Formatting:** Code is formatted with the project's ESLint config
- **Naming:**
  - Components: PascalCase (`ArticleList.tsx`)
  - Utilities: camelCase (`formatDate.ts`)
  - Constants: UPPER_SNAKE_CASE
  - Types/Interfaces: PascalCase

### API Guidelines

- Follow RESTful conventions
- Use proper HTTP status codes
- Validate all input with Zod schemas
- Document new endpoints in OpenAPI spec
- Add appropriate rate limiting

### Database Guidelines

- Use Drizzle ORM for all database operations
- Create migrations for schema changes:
  ```bash
  pnpm db:generate
  ```
- Never modify existing migrations
- Add indexes for frequently queried columns

### Frontend Guidelines

- Use Tailwind CSS for styling
- Follow the existing component patterns
- Use Zustand for client state
- Use TanStack Query for server state
- Ensure accessibility (ARIA labels, keyboard navigation)

### Testing

- Write tests for new functionality
- Ensure existing tests pass
- Test edge cases and error scenarios

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
| `pnpm clean` | Remove build artifacts |

## Questions?

- Open a [Discussion](https://github.com/jezzlucena/a-RSS/discussions) for questions
- Join the community chat (if available)
- Check the [documentation](./docs/)

## Recognition

Contributors will be recognized in the project README. Thank you for helping make a-RSS better!

## License

By contributing to a-RSS, you agree that your contributions will be licensed under the MIT License.
