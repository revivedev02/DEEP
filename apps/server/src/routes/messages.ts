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
}
