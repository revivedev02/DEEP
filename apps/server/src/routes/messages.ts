import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

// Shared include for message queries — always pull replyTo, user, and reactions
export const messageInclude = {
  user: {
    select: { id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true },
  },
  replyTo: {
    include: {
      user: { select: { id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true } },
    },
  },
  reactions: {
    select: { emoji: true, userId: true },
  },
} as const;

export async function registerMessageRoutes(app: FastifyInstance) {

  // GET /api/messages?channelId=xxx&limit=50&before=<messageId>
  app.get<{ Querystring: { channelId: string; limit?: string; before?: string } }>(
    '/api/messages',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { channelId, before } = req.query;
      if (!channelId) return reply.code(400).send({ error: 'channelId is required' });

      const limit = Math.min(Number(req.query.limit ?? 50), 100);

      const messages = await prisma.message.findMany({
        where: { channelId },
        include: messageInclude,
        orderBy: { createdAt: 'asc' },
        take: limit,
        // Use Prisma cursor pagination — avoids sub-query, uses index directly
        ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      });

      return reply.send(messages);
    }
  );

  // GET /api/messages/pinned?channelId=xxx — all pinned messages in a channel
  app.get<{ Querystring: { channelId: string } }>(
    '/api/messages/pinned',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { channelId } = req.query;
      if (!channelId) return reply.code(400).send({ error: 'channelId is required' });

      const pinned = await prisma.message.findMany({
        where: { channelId, pinned: true },
        include: messageInclude,
        orderBy: { createdAt: 'desc' },
      });

      return reply.send(pinned);
    }
  );

  // POST /api/messages/:id/pin — toggle pinned (admin only)
  app.post<{ Params: { id: string } }>(
    '/api/messages/:id/pin',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string; isAdmin: boolean };
      if (!payload.isAdmin) return reply.code(403).send({ error: 'Admins only' });

      const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
      if (!msg) return reply.code(404).send({ error: 'Not found' });

      const updated = await prisma.message.update({
        where: { id: req.params.id },
        data:  { pinned: !msg.pinned },
        include: messageInclude,
      });

      (app as any).io?.to(updated.channelId).emit('message:pinned', {
        messageId: updated.id,
        channelId: updated.channelId,
        pinned:    updated.pinned,
        message:   updated,
      });

      return reply.send(updated);
    }
  );

  // POST /api/messages/:id/reactions — toggle a reaction (add if absent, remove if present)
  app.post<{ Params: { id: string }; Body: { emoji: string } }>(
    '/api/messages/:id/reactions',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string; isAdmin: boolean };
      const { emoji } = req.body as { emoji?: string };
      if (!emoji?.trim()) return reply.code(400).send({ error: 'emoji is required' });

      const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
      if (!msg) return reply.code(404).send({ error: 'Not found' });

      // Toggle: delete if exists, create if absent
      const existing = await prisma.reaction.findUnique({
        where: { messageId_userId_emoji: { messageId: req.params.id, userId: payload.sub, emoji } },
      });

      if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.reaction.create({
          data: { emoji, userId: payload.sub, messageId: req.params.id },
        });
      }

      // Return updated reaction list for this message
      const reactions = await prisma.reaction.findMany({
        where:  { messageId: req.params.id },
        select: { emoji: true, userId: true },
      });

      // Broadcast to channel
      (app as any).io?.to(msg.channelId).emit('message:reaction', {
        messageId: req.params.id,
        reactions,
      });

      return reply.send({ reactions });
    }
  );

  // PATCH /api/messages/:id — edit content (own message or admin)
  app.patch<{ Params: { id: string }; Body: { content: string } }>(
    '/api/messages/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string; isAdmin: boolean };
      const { content } = req.body as { content?: string };

      if (!content?.trim()) return reply.code(400).send({ error: 'Content is required' });

      const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
      if (!msg) return reply.code(404).send({ error: 'Not found' });
      if (msg.userId !== payload.sub && !payload.isAdmin)
        return reply.code(403).send({ error: 'Forbidden' });

      const updated = await prisma.message.update({
        where: { id: req.params.id },
        data:  { content: content.trim(), editedAt: new Date() },
        include: messageInclude,
      });

      (app as any).io?.to(updated.channelId).emit('message:edited', {
        messageId: updated.id,
        content:   updated.content,
        editedAt:  updated.editedAt,
      });

      return reply.send(updated);
    }
  );

  // DELETE /api/messages/:id — own message or admin only
  app.delete<{ Params: { id: string } }>(
    '/api/messages/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string; isAdmin: boolean };
      const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
      if (!msg) return reply.code(404).send({ error: 'Not found' });
      if (msg.userId !== payload.sub && !payload.isAdmin)
        return reply.code(403).send({ error: 'Forbidden' });
      await prisma.message.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    }
  );
}
