import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import staticPlugin from '@fastify/static';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { registerAuthRoutes, addAuthDecorator } from './routes/auth.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerMemberRoutes } from './routes/members.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerChannelRoutes } from './routes/channels.js';
import { registerUploadRoutes } from './routes/upload.js';
import { registerDMRoutes } from './routes/dm.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { initMediasoup } from './lib/mediasoupManager.js';
import { prisma } from './lib/prisma.js';
import multipart from '@fastify/multipart';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT    = Number(process.env.PORT ?? 3000);
const HOST    = '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const app = Fastify({ logger: { level: IS_PROD ? 'warn' : 'info' } });

// ── CORS ─────────────────────────────────────────────────────────────────────
await app.register(cors, { origin: true, credentials: true });

// ── Gzip/Brotli compression ───────────────────────────────────────────────────
await app.register(compress, { global: true });

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Global default: 300 requests per minute per IP.
// Tighter limits are added per-route inside the auth handler.
await app.register(rateLimit, {
  global:    true,
  max:       300,
  timeWindow: '1 minute',
  errorResponseBuilder: (_req, context) => ({
    code:        429,
    error:       'Too Many Requests',
    message:     `Rate limit exceeded. Retry in ${Math.ceil(context.ttl / 1000)}s.`,
    statusCode:  429,
  }),
  // Use IP address as the key; x-forwarded-for aware
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
    ?? req.ip,
});

// ── JWT ───────────────────────────────────────────────────────────────────────
await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'fallback-dev-secret-change-me',
  sign: {
    expiresIn: '30d', // Token expiry — refresh not needed for this app pattern
  },
});
addAuthDecorator(app);

// ── Multipart (file uploads) ──────────────────────────────────────────────────
await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } });

// ── Serve built React app ─────────────────────────────────────────────────────
if (IS_PROD) {
  const webDist = resolve(__dirname, '../../../apps/web/dist');
  await app.register(staticPlugin, {
    root: webDist,
    prefix: '/',
    setHeaders(res, path) {
      if (path.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', {
  config: { rateLimit: { max: 60, timeWindow: '1 minute' } }, // generous for load balancer probes
}, async () => ({ status: 'ok', ts: Date.now() }));

// ── Routes ────────────────────────────────────────────────────────────────────
await registerAuthRoutes(app);
await registerMessageRoutes(app);
await registerAdminRoutes(app);
await registerMemberRoutes(app);
await registerSettingsRoutes(app);
await registerChannelRoutes(app);
await registerUploadRoutes(app);
await registerDMRoutes(app);

// SPA fallback (prod)
if (IS_PROD) {
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });
}

// ── Socket.IO + Redis Adapter ─────────────────────────────────────────────────
await app.ready();

const io = new Server(app.server, {
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
  pingTimeout:  30000,
  pingInterval: 15000,
  // Compress websocket frames > 256 bytes
  perMessageDeflate: { threshold: 256 },
  // How long to wait before considering a transport upgrade failed
  upgradeTimeout: 10000,
  // Max payload size per socket event (prevent large object attacks)
  maxHttpBufferSize: 1e6, // 1 MB
});

// Wire Redis adapter (enables pm2 cluster + multiple server instances)
// Graceful fallback: if Redis is unavailable, single-process mode still works
try {
  const redisOpts = {
    // Don't retry forever if Redis isn't available — fail fast, fall back to single-process
    retryStrategy: () => null,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    lazyConnect: false,
  };

  const pubClient = new Redis(REDIS_URL, redisOpts);
  const subClient = pubClient.duplicate(redisOpts);

  // Suppress unhandled error events after the initial failure (ioredis emits these on retry)
  pubClient.on('error', () => {});
  subClient.on('error', () => {});

  // Wait for 'ready' or 'error' — race with a 4s timeout as safety net
  const connectClient = (client: typeof pubClient) =>
    Promise.race([
      new Promise<void>((res, rej) => { client.once('ready', res); client.once('error', rej); }),
      new Promise<void>((_, rej) => setTimeout(() => rej(new Error('Redis connect timeout')), 4000)),
    ]);

  await Promise.all([connectClient(pubClient), connectClient(subClient)]);

  io.adapter(createAdapter(pubClient, subClient));

  console.log('✅  Socket.IO Redis adapter connected — cluster mode enabled');

  // Cleanup on shutdown
  const shutdown = async () => {
    pubClient.disconnect();
    subClient.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);

} catch (err) {
  console.warn(
    '⚠️  Redis unavailable — running in single-process mode (socket events will not sync across workers).',
    (err as Error).message,
  );
}

// Attach io to app so route handlers can emit events
(app as any).io = io;

// Initialise mediasoup SFU worker (must run before sockets are wired)
try {
  await initMediasoup();
  console.log('✅  mediasoup SFU worker ready');
} catch (err) {
  console.error('⚠️  mediasoup init failed — voice channels will not work', err);
}

setupSocketHandlers(io, app);

// ── Listen ────────────────────────────────────────────────────────────────────
await app.listen({ port: PORT, host: HOST });
console.log(`\n🚀  DEEP server running on http://localhost:${PORT}\n`);

// ── Seed (idempotent) ─────────────────────────────────────────────────────────
try {
  const adminShortId = process.env.ADMIN_SHORTID ?? 'admin_init';
  const exists = await prisma.user.findUnique({ where: { shortId: adminShortId } });
  if (!exists) {
    await prisma.user.create({
      data: {
        shortId:     adminShortId,
        displayName: 'Admin',
        username:    'admin',
        isAdmin:     true,
      },
    });
    console.log(`✅  Admin seeded — login ID: ${adminShortId}`);
  } else {
    console.log(`✅  Admin exists — login ID: ${adminShortId}`);
  }
  const channelCount = await prisma.channel.count();
  if (channelCount === 0) {
    await prisma.channel.createMany({
      data: [
        { id: 'text-main',    name: 'general', type: 'text',  position: 0 },
        { id: 'voice-lounge', name: 'lounge',  type: 'voice', position: 1 },
      ],
    });
    console.log('✅  Default channels seeded.');
  }
  await prisma.serverSettings.upsert({
    where:  { id: 'main' },
    update: {},
    create: { id: 'main', serverName: 'DEEP' },
  });
} catch (e) {
  console.error('⚠️  Seed error:', e);
}
