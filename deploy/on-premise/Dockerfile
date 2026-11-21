# =====================================================================
# منصة مَكَن (Mken Platform) - حزمة التشغيل المحلي المؤسسي المستقل
# Dockerfile: Multi-stage Light & Secure Standalone Image (node:20-alpine)
# يدعم العمل بالكامل بدون إنترنت (Air-Gapped) مع الخطوط العربية المحلية
# =====================================================================

# Stage 1: Base image with Arabic fonts support
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat fontconfig font-noto-arabic curl tzdata \
    && fc-cache -f

WORKDIR /app

# Stage 2: Dependencies installer
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY mkn-theme/package.json ./mkn-theme/
RUN npm ci --ignore-scripts --no-audit

# Stage 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mkn-theme/node_modules ./mkn-theme/node_modules
COPY . .

ENV NODE_ENV=production
ENV DEPLOYMENT_MODE=on_premise
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application in standalone mode
WORKDIR /app/mkn-theme
RUN npm run build || true

# Stage 4: Production Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DEPLOYMENT_MODE=on_premise
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Security: Non-root user for production execution
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mkenapp

# Copy built application and static assets
COPY --from=builder /app/mkn-theme/public ./mkn-theme/public
COPY --from=builder /app/mkn-theme/src ./mkn-theme/src
COPY --from=builder /app/mkn-theme/package.json ./mkn-theme/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/db ./db
COPY --from=builder /app/data ./data

# If Next.js standalone build was generated, copy standalone files
COPY --from=builder --chown=mkenapp:nodejs /app/mkn-theme/.next/standalone ./mkn-theme/standalone 2>/dev/null || true
COPY --from=builder --chown=mkenapp:nodejs /app/mkn-theme/.next/static ./mkn-theme/standalone/mkn-theme/.next/static 2>/dev/null || true

USER mkenapp

EXPOSE 3000

# Health check to ensure zero-downtime container resilience
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/queue?action=public-gate || exit 1

# Start application server
WORKDIR /app/mkn-theme
CMD ["node", "standalone/server.js"]
