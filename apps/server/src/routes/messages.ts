import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

// Shared include for message queries — always pull replyTo with user
export const messageInclude = {
  user: {
    select: { id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true },
  },
  replyTo: {
    include: {
      user: { select: { id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true } },
    },
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
        where: {
          channelId,
          ...(before
            ? { createdAt: { lt: new Date((await prisma.message.findUnique({ where: { id: before } }))?.createdAt ?? new Date()) } }
            : {}),
        },
        include: messageInclude,
        orderBy: { createdAt: 'asc' },
        take:    limit,
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

  // PATCH /api/messages/:id/pin — toggle pinned (admin only)
  app.patch<{ Params: { id: string } }>(
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

      // Broadcast pin/unpin to all clients in the channel
      (app as any).io?.to(updated.channelId).emit('message:pinned', {
        messageId: updated.id,
        channelId: updated.channelId,
        pinned:    updated.pinned,
        message:   updated,
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
