import { PrismaClient } from '@prisma/client';

// ── Connection pool sizing ────────────────────────────────────────────────────
// Rule of thumb: connection_limit = (num_cpu_cores * 2) + 1
// In cluster mode pm2 spawns N workers, each gets its own pool.
// With 4 cores → 4 workers × 9 connections = 36 total DB connections.
// PgBouncer / Supabase Pooler can multiply this further.
const CONNECTION_LIMIT = parseInt(process.env.DB_POOL_SIZE ?? '9', 10);

// Build the connection URL with pgbouncer-safe pool params when postgres
function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('postgres')) return url; // SQLite — return as-is

  try {
    const parsed = new URL(url);
    // connection_limit controls Prisma's own pool
    parsed.searchParams.set('connection_limit', String(CONNECTION_LIMIT));
    // Pgbouncer transaction mode compatibility
    parsed.searchParams.set('pgbouncer', 'true');
    parsed.searchParams.set('connect_timeout', '10');
    return parsed.toString();
  } catch {
    return url;
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// SQLite-only WAL optimizations (skipped in production)
if (!(process.env.DATABASE_URL ?? '').startsWith('postgres')) {
  prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {});
  prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL').catch(() => {});
  prisma.$executeRawUnsafe('PRAGMA cache_size = -20000').catch(() => {});
}
