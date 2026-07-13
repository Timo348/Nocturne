FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:/tmp/nocturne-build.db"
RUN pnpm build

FROM base AS runner
ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV DATABASE_URL="file:/data/nocturne.db"
ENV HOME="/tmp"
RUN groupadd --system --gid 1001 nocturne && useradd --system --uid 1001 --gid nocturne nocturne && mkdir -p /data && chown nocturne:nocturne /data
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/generated ./src/generated
USER nocturne
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/tsx prisma/seed.ts && ./node_modules/.bin/next start"]
