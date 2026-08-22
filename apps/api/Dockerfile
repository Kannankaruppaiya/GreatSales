# ==============================================================================
# GreatSales API — Multi-Stage Production & Staging Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base & Dependencies
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copy root workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy packages and API application definitions
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Build dependencies in topological order
RUN pnpm --filter @greatsales/shared build
RUN pnpm --filter @greatsales/db db:generate
RUN pnpm --filter api build

# ------------------------------------------------------------------------------
# Stage 2: Runtime Image
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl curl wget

WORKDIR /app

ENV NODE_ENV=staging
ENV PORT=3000
ENV PATH="/app/node_modules/.bin:/app/apps/api/node_modules/.bin:${PATH}"
ENV NODE_PATH="/app/apps/api/node_modules:/app/node_modules"

# Create non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy root configuration and built packages
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=nestjs:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=nestjs:nodejs /app/apps/api ./apps/api

USER nestjs

EXPOSE 3000

# Health check probe against API health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
