import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function registerMemberRoutes(app: FastifyInstance) {

  // GET /api/members  -> public user list (no shortId)
  app.get('/api/members', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const users = await prisma.user.findMany({
      select: {
        id:          true,
        displayName: true,
        username:    true,
        avatarUrl:   true,
        bannerUrl:   true,
        isAdmin:     true,
        createdAt:   true,
      },
      orderBy: [{ isAdmin: 'desc' }, { displayName: 'asc' }],
    });
    return reply.send(users);
  });
}
