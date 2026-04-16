import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

const CHANNEL_ID = 'text-main';

export async function registerMessageRoutes(app: FastifyInstance) {

  // GET /api/messages?limit=50&before=<messageId>
  app.get<{ Querystring: { limit?: string; before?: string } }>(
    '/api/messages',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const limit  = Math.min(Number(req.query.limit ?? 50), 100);
      const before = req.query.before;

      const messages = await prisma.message.findMany({
        where:   {
          channelId: CHANNEL_ID,
          ...(before ? { createdAt: { lt: new Date((await prisma.message.findUnique({ where: { id: before } }))?.createdAt ?? new Date()) } } : {}),
        },
        include: {
          user: {
            select: { id: true, displayName: true, username: true, avatarUrl: true, isAdmin: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        take:    limit,
      });

      return reply.send(messages);
    }
  );

  // DELETE /api/messages/:id  — own message or admin only
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
