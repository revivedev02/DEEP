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
import { setupSocketHandlers } from './socket/handlers.js';

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
