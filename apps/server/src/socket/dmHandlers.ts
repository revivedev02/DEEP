import type { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { destroyImage } from '../lib/cloudinary.js';

const dmSendSchema = z.object({
  conversationId: z.string().min(1),
  content:        z.string().max(4000),
  replyToId:      z.string().optional(),
  mediaUrl:       z.string().url().optional(),
  mediaType:      z.enum(['image', 'video']).optional(),
});

const dmUserSelect = {
  id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true,
} as const;

const dmMsgInclude = {
  user:      { select: dmUserSelect },
  reactions: { select: { emoji: true, userId: true } },
  replyTo:   { include: { user: { select: dmUserSelect } } },
} as const;

export function setupDMSocketHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId as string;

  // ── Join DM room ────────────────────────────────────────────────────────────
  socket.on('dm:join', async ({ conversationId }: { conversationId: string }) => {
    const p = await prisma.dMParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!p) return;
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('dm:'));
    for (const room of rooms) socket.leave(room);
    socket.join(`dm:${conversationId}`);
  });

  // ── Send message ────────────────────────────────────────────────────────────
  socket.on('dm:send', async (data: unknown) => {
    const parsed = dmSendSchema.safeParse(data);
    if (!parsed.success) return;
    const { conversationId, content, replyToId, mediaUrl, mediaType } = parsed.data;

    // Must have content OR media
    if (!content.trim() && !mediaUrl) return;

    const participant = await prisma.dMParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) return;

    try {
      const message = await prisma.directMessage.create({
        data: {
          content:        content.trim(),
          userId,
          conversationId,
          replyToId:  replyToId  ?? null,
          mediaUrl:   mediaUrl   ?? null,
          mediaType:  mediaType  ?? null,
        },
        include: dmMsgInclude,
      });
      io.to(`dm:${conversationId}`).emit('dm:message', message);
      io.to(`dm:${conversationId}`).emit('dm:conversation:update', { conversationId, lastMessage: message });
    } catch (err) {
      console.error('[dm:send]', err);
    }
  });

  // ── Edit message ────────────────────────────────────────────────────────────
  socket.on('dm:edit', async ({ messageId, content }: { messageId: string; content: string }) => {
    if (!messageId || !content?.trim()) return;
    try {
      const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
      if (!msg || msg.userId !== userId) return;
      const updated = await prisma.directMessage.update({
        where: { id: messageId },
        data:  { content: content.trim(), editedAt: new Date() },
      });
      io.to(`dm:${updated.conversationId}`).emit('dm:message:edited', {
        messageId: updated.id,
        content:   updated.content,
        editedAt:  updated.editedAt?.toISOString(),
      });
    } catch (err) {
      console.error('[dm:edit]', err);
    }
  });

  // ── Delete message ──────────────────────────────────────────────────────────
  // Called from REST but we also support socket-side for instant partner sync
  socket.on('dm:delete', async ({ messageId }: { messageId: string }) => {
    if (!messageId) return;
    try {
      const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
      if (!msg || msg.userId !== userId) return;
      await prisma.directMessage.delete({ where: { id: messageId } });
      // Clean up Cloudinary media if present
      if (msg.mediaUrl) destroyImage(msg.mediaUrl).catch(() => {});
      io.to(`dm:${msg.conversationId}`).emit('dm:message:deleted', { messageId });
    } catch (err) {
      console.error('[dm:delete]', err);
    }
  });

  // ── Typing indicator ────────────────────────────────────────────────────────
  const dmTypingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  socket.on('dm:typing', ({ conversationId, typing }: { conversationId: string; typing: boolean }) => {
    const room        = `dm:${conversationId}`;
    const displayName = (socket as any).displayName as string;
    socket.to(room).emit('dm:typing:update', { displayName, typing });
    if (typing) {
      clearTimeout(dmTypingTimers.get(conversationId));
      dmTypingTimers.set(conversationId, setTimeout(() => {
        socket.to(room).emit('dm:typing:update', { displayName, typing: false });
      }, 4000));
    } else {
      clearTimeout(dmTypingTimers.get(conversationId));
    }
  });
}
