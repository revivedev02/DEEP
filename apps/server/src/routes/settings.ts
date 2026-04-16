import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function registerSettingsRoutes(app: FastifyInstance) {

  // GET /api/settings
  app.get('/api/settings', async (_req, reply) => {
    const settings = await prisma.serverSettings.upsert({
      where:  { id: 'main' },
      update: {},
      create: { id: 'main', serverName: 'DEEP' },
    });
    return reply.send(settings);
  });

  // PATCH /api/settings  { serverName }  — admin only
  app.patch<{ Body: { serverName: string } }>(
    '/api/settings',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const p = req.user as { isAdmin?: boolean };
      if (!p.isAdmin) return reply.code(403).send({ error: 'Admin only.' });

      const { serverName } = req.body;
      if (!serverName?.trim()) return reply.code(400).send({ error: 'serverName required.' });

      const settings = await prisma.serverSettings.upsert({
        where:  { id: 'main' },
        update: { serverName: serverName.trim() },
        create: { id: 'main', serverName: serverName.trim() },
      });

      return reply.send(settings);
    }
  );
}
