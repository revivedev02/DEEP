import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

const dmUserInclude = {
  select: { id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true },
} as const;

const dmMsgInclude = {
  user: dmUserInclude,
  reactions: { select: { emoji: true, userId: true } },
  replyTo: {
    include: { user: dmUserInclude },
  },
} as const;

export async function registerDMRoutes(app: FastifyInstance) {

  // GET /api/dm/conversations
  app.get('/api/dm/conversations', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const conversations = await prisma.directConversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: dmUserInclude } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: dmMsgInclude },
      },
      orderBy: { createdAt: 'desc' },
    });
    const shaped = conversations.map(c => ({
      id: c.id,
      createdAt: c.createdAt,
      partner: c.participants.find(p => p.userId !== userId)?.user ?? null,
      lastMessage: c.messages[0] ?? null,
    }));
    return reply.send(shaped);
  });

  // POST /api/dm/conversations
  app.post<{ Body: { targetUserId: string } }>(
    '/api/dm/conversations',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { targetUserId } = req.body;
      if (!targetUserId || targetUserId === userId)
        return reply.code(400).send({ error: 'Invalid targetUserId' });

      const existing = await prisma.directConversation.findFirst({
        where: {
          AND: [
            { participants: { some: { userId } } },
            { participants: { some: { userId: targetUserId } } },
          ],
        },
        include: {
          participants: { include: { user: dmUserInclude } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, include: dmMsgInclude },
        },
      });
      if (existing) {
        return reply.send({
          id: existing.id,
          createdAt: existing.createdAt,
          partner: existing.participants.find(p => p.userId !== userId)?.user ?? null,
          lastMessage: existing.messages[0] ?? null,
        });
      }
      const created = await prisma.directConversation.create({
        data: { participants: { create: [{ userId }, { userId: targetUserId }] } },
        include: {
          participants: { include: { user: dmUserInclude } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, include: dmMsgInclude },
        },
      });
      return reply.code(201).send({
        id: created.id,
        createdAt: created.createdAt,
        partner: created.participants.find(p => p.userId !== userId)?.user ?? null,
        lastMessage: null,
      });
    }
  );

  // GET /api/dm/:conversationId/messages
  app.get<{ Params: { conversationId: string }; Querystring: { before?: string; limit?: string } }>(
    '/api/dm/:conversationId/messages',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { conversationId } = req.params;
      const { before } = req.query;
      const limit = Math.min(Number(req.query.limit ?? 50), 100);

      const participant = await prisma.dMParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
      });
      if (!participant) return reply.code(403).send({ error: 'Not a participant' });

      if (before) {
        const messages = await prisma.directMessage.findMany({
          where: { conversationId },
          include: dmMsgInclude,
          orderBy: { createdAt: 'asc' },
          cursor: { id: before },
          skip: 1,
          take: -limit,
        });
        return reply.send(messages);
      }
      const messages = await prisma.directMessage.findMany({
        where: { conversationId },
        include: dmMsgInclude,
        orderBy: { createdAt: 'asc' },
        take: -limit,
      });
      return reply.send(messages);
    }
  );

  // DELETE /api/dm/messages/:id
  app.delete<{ Params: { id: string } }>(
    '/api/dm/messages/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { id } = req.params;
      const msg = await prisma.directMessage.findUnique({ where: { id } });
      if (!msg) return reply.code(404).send({ error: 'Not found' });
      if (msg.userId !== userId) return reply.code(403).send({ error: 'Forbidden' });
      await prisma.directMessage.delete({ where: { id } });
      return reply.send({ ok: true });
    }
  );

  // PATCH /api/dm/messages/:id — edit
  app.patch<{ Params: { id: string }; Body: { content: string } }>(
    '/api/dm/messages/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { id } = req.params;
      const { content } = req.body;
      if (!content?.trim()) return reply.code(400).send({ error: 'Empty content' });
      const msg = await prisma.directMessage.findUnique({ where: { id } });
      if (!msg) return reply.code(404).send({ error: 'Not found' });
      if (msg.userId !== userId) return reply.code(403).send({ error: 'Forbidden' });
      const updated = await prisma.directMessage.update({
        where: { id },
        data: { content: content.trim(), editedAt: new Date() },
        include: dmMsgInclude,
      });
      return reply.send(updated);
    }
  );

  // POST /api/dm/messages/:id/reactions — toggle reaction
  app.post<{ Params: { id: string }; Body: { emoji: string } }>(
    '/api/dm/messages/:id/reactions',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { id } = req.params;
      const { emoji } = req.body;
      if (!emoji) return reply.code(400).send({ error: 'No emoji' });
      const existing = await prisma.dMReaction.findUnique({
        where: { messageId_userId_emoji: { messageId: id, userId, emoji } },
      });
      if (existing) {
        await prisma.dMReaction.delete({
          where: { messageId_userId_emoji: { messageId: id, userId, emoji } },
        });
      } else {
        await prisma.dMReaction.create({ data: { messageId: id, userId, emoji } });
      }
      const reactions = await prisma.dMReaction.findMany({
        where: { messageId: id },
        select: { emoji: true, userId: true },
      });
      return reply.send({ reactions });
    }
  );

  // POST /api/dm/messages/:id/pin — toggle pin
  app.post<{ Params: { id: string } }>(
    '/api/dm/messages/:id/pin',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { id } = req.params;
      const msg = await prisma.directMessage.findUnique({ where: { id } });
      if (!msg) return reply.code(404).send({ error: 'Not found' });

      // Verify user is a participant in the conversation
      const participant = await prisma.dMParticipant.findUnique({
        where: { conversationId_userId: { conversationId: msg.conversationId, userId } },
      });
      if (!participant) return reply.code(403).send({ error: 'Forbidden' });

      const updated = await prisma.directMessage.update({
        where: { id },
        data: { pinned: !msg.pinned },
      });

      // Broadcast to everyone in the DM room
      const io = (app as any).io;
      if (io) {
        io.to(`dm:${msg.conversationId}`).emit('dm:message:pinned', {
          messageId: id,
          pinned: updated.pinned,
        });
      }

      return reply.send({ pinned: updated.pinned });
    }
  );

  // DELETE /api/dm/conversations/:id — hide
  app.delete<{ Params: { id: string } }>(
    '/api/dm/conversations/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { id } = req.params;
      await prisma.dMParticipant.deleteMany({ where: { conversationId: id, userId } });
      return reply.send({ ok: true });
    }
  );
}
