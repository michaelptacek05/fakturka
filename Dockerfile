# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps: sdílené node_modules včetně devDependencies (Prisma CLI, TypeScript).
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder: vygeneruje Prisma klienta a sestaví Next.js standalone výstup.
# ---------------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run prisma:generate
RUN npm run build

# ---------------------------------------------------------------------------
# migrator: samostatný image pro `prisma migrate deploy`.
# Publikuje se jako :migrate a používá ho jednorázová služba `migrate`.
# Musí obsahovat Prisma CLI, schéma i adresář s migracemi.
# ---------------------------------------------------------------------------
FROM deps AS migrator
WORKDIR /app

ENV NODE_ENV=production
# Data dokladů se ukládají jako půlnoc bez zóny. Pevná zóna zajistí,
# že se datum vystavení ani splatnosti neposune o den.
ENV TZ=UTC

COPY prisma ./prisma
COPY prisma.config.ts ./

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 prisma \
  && chown -R prisma:nodejs /app

USER prisma

CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# runner: produkční image aplikace (publikuje se jako :latest).
# Obsahuje jen Next.js standalone server, žádné devDependencies.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Data dokladů se ukládají jako půlnoc bez zóny. Pevná zóna zajistí,
# že se datum vystavení ani splatnosti neposune o den.
ENV TZ=UTC

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /app/storage/invoice-assets && chown -R nextjs:nodejs /app/storage

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
