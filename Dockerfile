FROM node:20-slim
WORKDIR /app

# System deps: openssl + ca-certs for Prisma
RUN apt-get update -y && apt-get install -y \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace manifests + lockfile first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json    ./apps/web/
COPY packages/types/package.json ./packages/types/

# Copy prisma schema before install so postinstall can generate client
COPY apps/server/prisma ./apps/server/prisma

# Patch schema from sqlite → postgresql for production
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' apps/server/prisma/schema.prisma

# Install all dependencies (triggers prisma generate with postgresql)
RUN pnpm install --no-frozen-lockfile

# Copy all source
COPY . .

# Re-apply patch (COPY . . may have restored sqlite schema)
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' apps/server/prisma/schema.prisma

# Regenerate Prisma client with postgresql
RUN cd apps/server && pnpm exec prisma generate

# Build React frontend
RUN pnpm --filter @pdl/web build

EXPOSE 3000

# Run DB migration (best-effort) then start server
CMD ["sh", "-c", "cd /app/apps/server && pnpm exec prisma db push --accept-data-loss || echo 'prisma db push failed, continuing...' && node --import tsx/esm /app/apps/server/src/index.ts"]
