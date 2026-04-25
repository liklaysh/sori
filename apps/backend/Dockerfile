# Stage 1: Build
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy root workspace configs
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies (only for backend for now to keep it small)
RUN npm ci -w @sori/backend

# Copy source code
COPY apps/backend ./apps/backend
COPY packages ./packages

# Build the application
RUN npm run build -w @sori/backend

# Stage 2: Runtime
FROM node:20-bookworm-slim

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
RUN npm ci --omit=dev -w @sori/backend

# Copy built artifacts from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY apps/backend/drizzle ./apps/backend/drizzle

# Expose port
EXPOSE 3000

# Env vars will be handled by Docker Compose
ENV NODE_ENV=production

CMD ["node", "apps/backend/dist/index.js"]
