import type { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { messageInclude } from '../routes/messages.js';
import { setupDMSocketHandlers } from './dmHandlers.js';
import { destroyImage } from '../lib/cloudinary.js';

const onlineUsers = new Map<string, Set<string>>();

const sendSchema = z.object({
  content:   z.string().max(4000),
  channelId: z.string().min(1),
  replyToId: z.string().optional(),
  mediaUrl:  z.string().url().optional(),
  mediaType: z.enum(['image', 'video']).optional(),
});

export function setupSocketHandlers(io: Server, app: FastifyInstance) {

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('No token'));
      const payload = app.jwt.verify(token) as { sub: string; displayName: string; isAdmin: boolean };
      (socket as any).userId      = payload.sub;
      (socket as any).displayName = (payload as any).displayName ?? 'Someone';
      (socket as any).isAdmin     = payload.isAdmin;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId      = (socket as any).userId      as string;
    const displayName = (socket as any).displayName as string;

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);

    // Tell everyone this user is online
    io.emit('presence:update', { userId, online: true });

    // Send a snapshot of ALL currently online user IDs to the newly connected socket
    // This fixes: "I joined after others, so I missed their presence:update events"
    const onlineIds = Array.from(onlineUsers.keys());
    socket.emit('presence:snapshot', { onlineIds });

    // Wire DM socket handlers
    setupDMSocketHandlers(io, socket);

    // ── channel:join — move socket into channel-specific room ────────────────
    socket.on('channel:join', ({ channelId }: { channelId: string }) => {
      const rooms = Array.from(socket.rooms).filter(r => r.startsWith('channel:'));
      for (const room of rooms) socket.leave(room);
      socket.join(`channel:${channelId}`);
      (socket as any).activeChannelId = channelId;
    });

    // ── message:send ─────────────────────────────────────────────────────────
    socket.on('message:send', async (data: unknown) => {
      const parsed = sendSchema.safeParse(data);
      if (!parsed.success) return;

      const { content, channelId, replyToId, mediaUrl, mediaType } = parsed.data;

      // Must have content OR media (Discord allows image-only messages)
      if (!content.trim() && !mediaUrl) return;

      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) return;

      // Validate replyToId belongs to same channel
      if (replyToId) {
        const parent = await prisma.message.findUnique({ where: { id: replyToId } });
        if (!parent || parent.channelId !== channelId) return;
      }

      try {
        const message = await prisma.message.create({
          data: {
            content:   content.trim(),
            userId,
            channelId,
            replyToId: replyToId ?? null,
            mediaUrl:  mediaUrl  ?? null,
            mediaType: mediaType ?? null,
          },
          include: messageInclude,
        });
        io.to(`channel:${channelId}`).emit('message:new', message);
      } catch (err) {
        app.log.error(err, 'Failed to save message');
      }
    });

    // ── typing ───────────────────────────────────────────────────────────────
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

    socket.on('typing', ({ typing, channelId }: { typing: boolean; channelId?: string }) => {
      const room = channelId ? `channel:${channelId}` : `channel:${(socket as any).activeChannelId}`;
      if (!room || room === 'channel:undefined') return;
      socket.to(room).emit('typing:update', { displayName, typing });
      if (typing) {
        clearTimeout(typingTimers.get(userId));
        typingTimers.set(userId, setTimeout(() => {
          socket.to(room).emit('typing:update', { displayName, typing: false });
        }, 4000));
      } else {
        clearTimeout(typingTimers.get(userId));
      }
    });

    // ── avatar:update — broadcast new avatar URL to everyone ─────────────────
    socket.on('avatar:update', ({ avatarUrl }: { avatarUrl: string }) => {
      if (!avatarUrl) return;
      io.emit('user:avatar-updated', { userId, avatarUrl });
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
