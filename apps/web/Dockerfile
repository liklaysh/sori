# Stage 1: Build
FROM node:20-alpine AS builder

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

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL

RUN npm run build -w @sori/web

# Stage 2: Runtime
FROM nginx:alpine

# Copy built artifacts from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
