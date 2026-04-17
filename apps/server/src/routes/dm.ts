import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const dmUserInclude = {
  select: { id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true },
} as const;

const dmMsgInclude = {
  user: dmUserInclude,
} as const;

export async function registerDMRoutes(app: FastifyInstance) {

  // GET /api/dm/conversations — all DM conversations for the current user
  app.get('/api/dm/conversations', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as any).sub as string;

    const conversations = await prisma.directConversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: dmUserInclude } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: dmMsgInclude,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Shape: add "partner" field (the other participant) for convenience
    const shaped = conversations.map(c => ({
      id: c.id,
      createdAt: c.createdAt,
      partner: c.participants.find(p => p.userId !== userId)?.user ?? null,
      lastMessage: c.messages[0] ?? null,
    }));

    return reply.send(shaped);
  });

  // POST /api/dm/conversations — open (or get existing) DM with a user
  app.post<{ Body: { targetUserId: string } }>(
    '/api/dm/conversations',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { targetUserId } = req.body;

      if (!targetUserId || targetUserId === userId)
        return reply.code(400).send({ error: 'Invalid targetUserId' });

      // Check if conversation already exists between these two users
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

      // Create new conversation
      const created = await prisma.directConversation.create({
        data: {
          participants: {
            create: [{ userId }, { userId: targetUserId }],
          },
        },
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

  // GET /api/dm/:conversationId/messages?before=<id>&limit=50
  app.get<{ Params: { conversationId: string }; Querystring: { before?: string; limit?: string } }>(
    '/api/dm/:conversationId/messages',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { conversationId } = req.params;
      const { before } = req.query;
      const limit = Math.min(Number(req.query.limit ?? 50), 100);

      // Verify user is a participant
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

  // DELETE /api/dm/conversations/:id — remove user from conversation (hides it)
  app.delete<{ Params: { id: string } }>(
    '/api/dm/conversations/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req.user as any).sub as string;
      const { id } = req.params;
      await prisma.dMParticipant.deleteMany({
        where: { conversationId: id, userId },
      });
      return reply.send({ ok: true });
    }
  );
}
