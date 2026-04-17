import type { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const dmSendSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(4000),
});

const dmUserSelect = {
  id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true,
} as const;

export function setupDMSocketHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId as string;

  // Join a DM conversation room
  socket.on('dm:join', async ({ conversationId }: { conversationId: string }) => {
    // Verify participant
    const p = await prisma.dMParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!p) return;

    // Leave previous DM rooms
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('dm:'));
    for (const room of rooms) socket.leave(room);

    socket.join(`dm:${conversationId}`);
  });

  // Send a DM message
  socket.on('dm:send', async (data: unknown) => {
    const parsed = dmSendSchema.safeParse(data);
    if (!parsed.success) return;
    const { conversationId, content } = parsed.data;

    // Verify participant
    const participant = await prisma.dMParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) return;

    try {
      const message = await prisma.directMessage.create({
        data: { content, userId, conversationId },
        include: { user: { select: dmUserSelect } },
      });

      // Emit to everyone in the DM room (both participants)
      io.to(`dm:${conversationId}`).emit('dm:message', message);

      // Also notify the partner even if they haven't joined the DM room yet
      // so their DMList badge updates in real-time
      io.to(`dm:${conversationId}`).emit('dm:conversation:update', {
        conversationId,
        lastMessage: message,
      });
    } catch (err) {
      console.error('[dm:send] error:', err);
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
