import type { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const dmSendSchema = z.object({
  conversationId: z.string().min(1),
  content:        z.string().min(1).max(4000),
  replyToId:      z.string().optional(),
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

  // Join a DM conversation room
  socket.on('dm:join', async ({ conversationId }: { conversationId: string }) => {
    const p = await prisma.dMParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!p) return;
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('dm:'));
    for (const room of rooms) socket.leave(room);
    socket.join(`dm:${conversationId}`);
  });

  // Send a DM message (with optional reply)
  socket.on('dm:send', async (data: unknown) => {
    const parsed = dmSendSchema.safeParse(data);
    if (!parsed.success) return;
    const { conversationId, content, replyToId } = parsed.data;

    const participant = await prisma.dMParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) return;

    try {
      const message = await prisma.directMessage.create({
        data: { content, userId, conversationId, ...(replyToId ? { replyToId } : {}) },
        include: dmMsgInclude,
      });

      io.to(`dm:${conversationId}`).emit('dm:message', message);
      io.to(`dm:${conversationId}`).emit('dm:conversation:update', {
        conversationId,
        lastMessage: message,
      });
    } catch (err) {
      console.error('[dm:send] error:', err);
    }
  });

  // Edit a DM message — saves to DB + broadcasts to conversation room
  socket.on('dm:edit', async ({ messageId, content }: { messageId: string; content: string }) => {
    if (!messageId || !content?.trim()) return;
    try {
      const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
      if (!msg || msg.userId !== userId) return; // only author can edit
      const updated = await prisma.directMessage.update({
        where: { id: messageId },
        data: { content: content.trim(), editedAt: new Date() },
      });
      io.to(`dm:${updated.conversationId}`).emit('dm:message:edited', {
        messageId: updated.id,
        content: updated.content,
        editedAt: updated.editedAt?.toISOString(),
      });
    } catch (err) {
      console.error('[dm:edit] error:', err);
    }
  });

  // DM typing indicator
  const dmTypingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  socket.on('dm:typing', ({ conversationId, typing }: { conversationId: string; typing: boolean }) => {
    const room = `dm:${conversationId}`;
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
