import type { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const CHANNEL_ID = 'text-main';

// userId -> Set of socketIds (a user can have multiple tabs)
const onlineUsers = new Map<string, Set<string>>();

const sendSchema = z.object({
  content: z.string().min(1).max(4000),
});

export function setupSocketHandlers(io: Server, app: FastifyInstance) {

  // ── Middleware: verify JWT ─────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('No token'));

      const payload = app.jwt.verify(token) as { sub: string; isAdmin: boolean };
      (socket as any).userId  = payload.sub;
      (socket as any).isAdmin = payload.isAdmin;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId  = (socket as any).userId  as string;

    // Track presence
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);

    // Join channel room
    socket.join(CHANNEL_ID);

    // Broadcast online
    io.emit('presence:update', { userId, online: true });

    // ── message:send ──────────────────────────────────────────────────────────
    socket.on('message:send', async (data: unknown) => {
      const parsed = sendSchema.safeParse(data);
      if (!parsed.success) return;

      try {
        const message = await prisma.message.create({
          data: {
            content:   parsed.data.content,
            userId,
            channelId: CHANNEL_ID,
          },
          include: {
            user: {
              select: { id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true },
            },
          },
        });

        io.to(CHANNEL_ID).emit('message:new', message);
      } catch (err) {
        app.log.error(err, 'Failed to save message');
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('presence:update', { userId, online: false });
        }
      }
    });
  });
}
