import type { FastifyInstance } from 'fastify';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../lib/prisma.js';

export async function registerUploadRoutes(app: FastifyInstance) {

  // ── GET /api/upload/sign ──────────────────────────────────────────────────
  // Returns a short-lived signed payload so the browser can upload directly
  // to Cloudinary without the file ever passing through our server.
  app.get(
    '/api/upload/sign',
    { preHandler: [app.authenticate] },
    async (_req, reply) => {
      const timestamp      = Math.round(Date.now() / 1000);
      const folder         = 'deep/avatars';
      const transformation = 'c_fill,g_face,h_256,w_256,f_webp,q_auto:best';

      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder, transformation },
        process.env.CLOUDINARY_API_SECRET ?? '',
      );

      return reply.send({
        signature,
        timestamp,
        folder,
        transformation,
        api_key:    process.env.CLOUDINARY_API_KEY,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      });
    },
  );

  // ── GET /api/upload/sign-server-icon ─────────────────────────────────────
  // Admin-only signature for server icon upload
  app.get(
    '/api/upload/sign-server-icon',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { isAdmin: boolean };
      if (!payload.isAdmin) return reply.code(403).send({ error: 'Forbidden' });

      const timestamp      = Math.round(Date.now() / 1000);
      const folder         = 'deep/server';
      const transformation = 'c_fill,h_256,w_256,f_webp,q_auto:best';

      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder, transformation },
        process.env.CLOUDINARY_API_SECRET ?? '',
      );

      return reply.send({
        signature,
        timestamp,
        folder,
        transformation,
        api_key:    process.env.CLOUDINARY_API_KEY,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      });
    },
  );

  // ── PATCH /api/upload/avatar ──────────────────────────────────────────────
  // Called by the browser AFTER it has uploaded to Cloudinary directly.
  // Saves the returned CDN URL to the user's profile.
  app.patch<{ Body: { url: string } }>(
    '/api/upload/avatar',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string };
      const { url } = req.body;

      if (!url || !url.includes('cloudinary.com'))
        return reply.code(400).send({ error: 'Invalid Cloudinary URL' });

      await prisma.user.update({
        where: { id: payload.sub },
        data:  { avatarUrl: url },
      });

      return reply.send({ avatarUrl: url });
    },
  );

  // ── PATCH /api/upload/server-icon ─────────────────────────────────────────
  // Admin saves the server icon URL after browser-side upload
  app.patch<{ Body: { url: string } }>(
    '/api/upload/server-icon',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { isAdmin: boolean };
      if (!payload.isAdmin) return reply.code(403).send({ error: 'Forbidden' });

      const { url } = req.body;
      if (!url || !url.includes('cloudinary.com'))
        return reply.code(400).send({ error: 'Invalid Cloudinary URL' });

      await prisma.serverSettings.update({
        where: { id: 'main' },
        data:  { iconUrl: url },
      });

      return reply.send({ iconUrl: url });
    },
  );
}
