import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// SQLite-only optimizations (skip in production where PostgreSQL is used)
if (!process.env.DATABASE_URL?.includes('postgres')) {
  prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {});
  prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL').catch(() => {});
  prisma.$executeRawUnsafe('PRAGMA cache_size = -20000').catch(() => {});
}
