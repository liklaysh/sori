# Stage 1: Build
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy root workspace configs
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies
RUN npm ci -w @sori/web

# Copy source code
COPY apps/web ./apps/web
COPY packages ./packages

# Build the application
# Use ARGs to pass environment variables during build time
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_LIVEKIT_URL
ARG VITE_MAX_UPLOAD_SIZE_MB
ARG VITE_BUILD_ID
ARG VITE_BUILD_TIME

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL
ENV VITE_MAX_UPLOAD_SIZE_MB=$VITE_MAX_UPLOAD_SIZE_MB
ENV VITE_BUILD_ID=$VITE_BUILD_ID
ENV VITE_BUILD_TIME=$VITE_BUILD_TIME

RUN npm run build -w @sori/web

# Stage 2: Runtime
FROM caddy:2-alpine

# Copy built artifacts from builder
COPY --from=builder /app/apps/web/dist /srv

# SPA routing + static asset serving
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
