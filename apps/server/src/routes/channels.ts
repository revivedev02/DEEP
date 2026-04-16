import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function registerChannelRoutes(app: FastifyInstance) {

  // GET /api/channels — public (auth required)
  app.get('/api/channels', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const channels = await prisma.channel.findMany({ orderBy: { position: 'asc' } });
    return reply.send(channels);
  });

  // POST /api/channels  { name, type }  — admin only
  app.post<{ Body: { name: string; type?: string } }>(
    '/api/channels',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const p = req.user as { isAdmin?: boolean };
      if (!p.isAdmin) return reply.code(403).send({ error: 'Admin only.' });

      const { name, type = 'text' } = req.body;
      if (!name?.trim()) return reply.code(400).send({ error: 'name required.' });
      if (!['text', 'voice'].includes(type)) return reply.code(400).send({ error: 'type must be text or voice.' });

      const count = await prisma.channel.count();
      const channel = await prisma.channel.create({
        data: { name: name.trim().toLowerCase().replace(/\s+/g, '-'), type, position: count },
      });
      return reply.code(201).send(channel);
    }
  );

  // PATCH /api/channels/:id  { name }  — admin only
  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/api/channels/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const p = req.user as { isAdmin?: boolean };
      if (!p.isAdmin) return reply.code(403).send({ error: 'Admin only.' });

      const { name } = req.body;
      if (!name?.trim()) return reply.code(400).send({ error: 'name required.' });

      try {
        const channel = await prisma.channel.update({
          where: { id: req.params.id },
          data:  { name: name.trim().toLowerCase().replace(/\s+/g, '-') },
        });
        return reply.send(channel);
      } catch {
        return reply.code(404).send({ error: 'Channel not found.' });
      }
    }
  );

  // DELETE /api/channels/:id  — admin only
  app.delete<{ Params: { id: string } }>(
    '/api/channels/:id',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const p = req.user as { isAdmin?: boolean };
      if (!p.isAdmin) return reply.code(403).send({ error: 'Admin only.' });

      const count = await prisma.channel.count();
      if (count <= 1) return reply.code(400).send({ error: 'Cannot delete the last channel.' });

      try {
        await prisma.channel.delete({ where: { id: req.params.id } });
        return reply.code(204).send();
      } catch {
        return reply.code(404).send({ error: 'Channel not found.' });
      }
    }
  );
}
