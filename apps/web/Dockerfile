# Build stage
FROM node:25-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Install dependencies (with cache mount for pnpm store)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build arguments for environment variables
ARG VITE_API_URL=/api/v1

# Set build-time environment variables
ENV VITE_API_URL=$VITE_API_URL

# Build packages and web app
RUN pnpm turbo run build --filter=@arss/web...

# Production stage - nginx for serving static files
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Add non-root user permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

EXPOSE 8088

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
