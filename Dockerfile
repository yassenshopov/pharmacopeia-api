# pharmacopeia-api — self-host image.
#
# A clone-and-run path that doesn't assume Vercel. With no DATABASE_URL
# the app serves the static seed dataset baked into the bundle, so the
# image is useful out of the box; set DATABASE_URL to point it at a
# Supabase/Postgres backend.
#
#   docker build -t pharmacopeia-api .
#   docker run -p 3000:3000 pharmacopeia-api
#
# Multi-stage build on Next.js standalone output (next.config.ts sets
# `output: "standalone"`).

# ── deps ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# `postinstall` runs `prisma generate`, which needs the schema present.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ── builder ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runner ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server + static assets + public files are all that's needed.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# `server.js` is emitted by Next.js into the standalone output root.
CMD ["node", "server.js"]
