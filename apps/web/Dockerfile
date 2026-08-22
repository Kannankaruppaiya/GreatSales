# ==============================================================================
# GreatSales Web Console — Multi-Stage Production & Staging Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Web SPA
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copy root workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy packages and Web application definitions
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/web ./apps/web

# Build workspace dependencies
RUN pnpm --filter @greatsales/shared build
RUN pnpm --filter @greatsales/db db:generate

# Build Web SPA bundle with staging defaults (relative /api/v1 for Nginx reverse proxy)
ARG VITE_API_URL=/api/v1
ARG VITE_APP_ENV=staging
ARG VITE_APP_NAME="GreatSales Staging"

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN pnpm --filter web build

# ------------------------------------------------------------------------------
# Stage 2: Serve with Nginx Alpine
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built SPA assets from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

# Health check probe against Nginx health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
