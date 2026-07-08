# ── Build stage ────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bunx --bun astro build

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json

EXPOSE 30001

# Run migrations then start the server
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun dist/server/entry.mjs"]
