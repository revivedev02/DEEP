/**
 * voice.ts — LiveKit token endpoint
 * GET /api/voice/token?channelId=xxx
 * Returns a signed LiveKit JWT that lets the user join the room.
 * Room name = channelId, identity = userId, metadata = { avatarUrl }
 */
import type { FastifyInstance } from 'fastify';
import { AccessToken }         from 'livekit-server-sdk';

export async function registerVoiceRoutes(app: FastifyInstance) {

  app.get('/api/voice/token', { preHandler: [app.authenticate] }, async (req, reply) => {
    const channelId = (req.query as any).channelId as string | undefined;
    if (!channelId) return reply.code(400).send({ error: 'channelId required' });

    const payload = (req as any).user as { sub: string; displayName: string };
    const userId      = payload.sub;
    const displayName = payload.displayName ?? 'User';

    // Fetch avatarUrl so we can embed it in token metadata
    const { prisma } = await import('../lib/prisma.js');
    const userRecord  = await prisma.user.findUnique({
      where:  { id: userId },
      select: { avatarUrl: true },
    });

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY    ?? '',
      process.env.LIVEKIT_API_SECRET ?? '',
      {
        identity: userId,
        name:     displayName,
        ttl:      6 * 60 * 60, // 6 hours in seconds
        metadata: JSON.stringify({ avatarUrl: userRecord?.avatarUrl ?? null }),
      },
    );

    at.addGrant({
      room:          channelId,
      roomJoin:      true,
      canPublish:    true,
      canSubscribe:  true,
      canPublishData: true,
    });

    const token  = await at.toJwt();
    const wsUrl  = process.env.LIVEKIT_URL ?? '';

    return reply.send({ token, wsUrl });
  });
}
