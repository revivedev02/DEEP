import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function registerAuthRoutes(app: FastifyInstance) {

  // POST /api/auth/login  { shortId } -> { token, user }
  app.post<{ Body: { shortId: string } }>('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['shortId'],
        properties: { shortId: { type: 'string', minLength: 1 } },
      },
    },
  }, async (req, reply) => {
    const { shortId } = req.body;

    const user = await prisma.user.findUnique({ where: { shortId: shortId.trim() } });
    if (!user) {
      return reply.code(401).send({ error: 'Invalid member ID.' });
    }

    const token = app.jwt.sign(
      { sub: user.id, isAdmin: user.isAdmin },
      { expiresIn: '30d' }
    );

    return reply.send({
      token,
      user: {
        id:          user.id,
        shortId:     user.shortId,
        displayName: user.displayName,
        username:    user.username,
        avatarUrl:   user.avatarUrl,
        isAdmin:     user.isAdmin,
      },
    });
  });

  // GET /api/me  -> user (requires JWT)
  app.get('/api/me', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return reply.code(404).send({ error: 'Not found' });
    return reply.send({
      id:          user.id,
      shortId:     user.shortId,
      displayName: user.displayName,
      username:    user.username,
      avatarUrl:   user.avatarUrl,
      isAdmin:     user.isAdmin,
    });
  });
}

// Augment Fastify to add authenticate decorator + jwt user type
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

import type { FastifyRequest, FastifyReply } from 'fastify';

// Register authenticate decorator once at module level
// (called by index.ts via registerAuthRoutes, so we do it here)
export function addAuthDecorator(app: FastifyInstance) {
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}
