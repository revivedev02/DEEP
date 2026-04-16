import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import staticPlugin from '@fastify/static';
import { Server } from 'socket.io';
import { registerAuthRoutes, addAuthDecorator } from './routes/auth.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerMemberRoutes } from './routes/members.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerChannelRoutes } from './routes/channels.js';
import { registerUploadRoutes } from './routes/upload.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { prisma } from './lib/prisma.js';
import multipart from '@fastify/multipart';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT    = Number(process.env.PORT ?? 3000);
const HOST    = '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

const app = Fastify({ logger: { level: IS_PROD ? 'warn' : 'info' } });

// ── Plugins ──────────────────────────────────────────────────────────────────
await app.register(cors, { origin: true, credentials: true });

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'fallback-dev-secret-change-me',
});
addAuthDecorator(app);

// Multipart (file uploads)
await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } });

// Serve built React app in production
if (IS_PROD) {
  const webDist = resolve(__dirname, '../../../apps/web/dist');
  await app.register(staticPlugin, { root: webDist, prefix: '/' });
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async () => ({ status: 'ok', ts: Date.now() }));

// ── Routes ───────────────────────────────────────────────────────────────────
await registerAuthRoutes(app);
await registerMessageRoutes(app);
await registerAdminRoutes(app);
await registerMemberRoutes(app);
await registerSettingsRoutes(app);
await registerChannelRoutes(app);
await registerUploadRoutes(app);

// SPA fallback (prod)
if (IS_PROD) {
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });
}

// ── Socket.IO ────────────────────────────────────────────────────────────────
await app.ready();

const io = new Server(app.server, {
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
});

setupSocketHandlers(io, app);

// ── Listen ───────────────────────────────────────────────────────────────────
await app.listen({ port: PORT, host: HOST });
console.log(`\n🚀  DEEP server running on http://localhost:${PORT}\n`);

// ── Seed admin user (idempotent) ─────────────────────────────────────────────
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
  // Seed default channels
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
  // Seed server settings
  await prisma.serverSettings.upsert({
    where:  { id: 'main' },
    update: {},
    create: { id: 'main', serverName: 'DEEP' },
  });
} catch (e) {
  console.error('⚠️  Seed error:', e);
}
