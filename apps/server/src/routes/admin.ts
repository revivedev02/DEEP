import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

function genShortId() {
  return `usr_${nanoid()}`;
}

function requireAdmin(payload: { isAdmin?: boolean }, reply: FastifyReply): boolean {
  if (!payload.isAdmin) {
    reply.code(403).send({ error: 'Admin only.' });
    return false;
  }
  return true;
}

export async function registerAdminRoutes(app: FastifyInstance) {

  // GET /api/admin/users
  app.get('/api/admin/users', { preHandler: [app.authenticate] }, async (req, reply) => {
    const p = req.user as { isAdmin?: boolean };
    if (!requireAdmin(p, reply)) return;

    const users = await prisma.user.findMany({
      select: {
        id: true, shortId: true, displayName: true,
        username: true, isAdmin: true, createdAt: true,
      },
      orderBy: [{ isAdmin: 'desc' }, { createdAt: 'asc' }],
    });
    return reply.send(users);
  });

  // POST /api/admin/users   { displayName, username }
  app.post<{ Body: { displayName: string; username: string } }>(
    '/api/admin/users',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const p = req.user as { isAdmin?: boolean };
      if (!requireAdmin(p, reply)) return;

      const { displayName, username } = req.body;
      if (!displayName?.trim() || !username?.trim()) {
        return reply.code(400).send({ error: 'displayName and username required.' });
      }

      const shortId = genShortId();
      try {
        const user = await prisma.user.create({
          data: {
            shortId,
            displayName: displayName.trim(),
            username:    username.trim().toLowerCase().replace(/\s+/g, '_'),
          },
          select: {
            id: true, shortId: true, displayName: true,
            username: true, isAdmin: true, createdAt: true,
          },
        });
        return reply.code(201).send(user);
      } catch (e: any) {
        if (e.code === 'P2002') {
          return reply.code(409).send({ error: 'Username already taken.' });
        }
        throw e;
      }
    }
  );

  // DELETE /api/admin/users/:id
  app.delete<{ Params: { id: string } }>(
    '/api/admin/users/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const p = req.user as { isAdmin?: boolean };
      if (!requireAdmin(p, reply)) return;

      const { id } = req.params;
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return reply.code(404).send({ error: 'User not found.' });
      if (target.isAdmin) return reply.code(403).send({ error: 'Cannot delete admin.' });

      await prisma.message.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
      return reply.code(204).send();
    }
  );
}
