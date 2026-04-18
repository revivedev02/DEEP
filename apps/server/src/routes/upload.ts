import type { FastifyInstance } from 'fastify';
import { v2 as cloudinary } from 'cloudinary';
import { destroyImage } from '../lib/cloudinary.js';
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

      // Fetch the current avatar URL so we can delete the old asset
      const existing = await prisma.user.findUnique({
        where:  { id: payload.sub },
        select: { avatarUrl: true },
      });

      // Save new URL first, then clean up old asset (non-blocking)
      await prisma.user.update({
        where: { id: payload.sub },
        data:  { avatarUrl: url },
      });

      destroyImage(existing?.avatarUrl).catch(() => {});

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

      // Fetch current icon so we can delete the old asset
      const existing = await prisma.serverSettings.findUnique({
        where:  { id: 'main' },
        select: { iconUrl: true },
      });

      await prisma.serverSettings.update({
        where: { id: 'main' },
        data:  { iconUrl: url },
      });

      destroyImage(existing?.iconUrl).catch(() => {});

      return reply.send({ iconUrl: url });
    },
  );

  // ── GET /api/upload/sign-banner ──────────────────────────────────────────
  // Returns signed payload for banner upload (wide, landscape)
  app.get(
    '/api/upload/sign-banner',
    { preHandler: [app.authenticate] },
    async (_req, reply) => {
      const timestamp      = Math.round(Date.now() / 1000);
      const folder         = 'deep/banners';
      const transformation = 'c_fill,h_480,w_1440,f_webp,q_auto:best';

      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder, transformation },
        process.env.CLOUDINARY_API_SECRET ?? '',
      );

      return reply.send({
        signature, timestamp, folder, transformation,
        api_key:    process.env.CLOUDINARY_API_KEY,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      });
    },
  );

  // ── PATCH /api/upload/banner ──────────────────────────────────────────────
  app.patch<{ Body: { url: string } }>(
    '/api/upload/banner',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string };
      const { url } = req.body;
      if (!url || !url.includes('cloudinary.com'))
        return reply.code(400).send({ error: 'Invalid Cloudinary URL' });

      // Fetch current banner so we can delete the old asset
      const existing = await prisma.user.findUnique({
        where:  { id: payload.sub },
        select: { bannerUrl: true },
      });

      await prisma.user.update({
        where: { id: payload.sub },
        data:  { bannerUrl: url },
      });

      destroyImage(existing?.bannerUrl).catch(() => {});

      return reply.send({ bannerUrl: url });
    },
  );

  // ── GET /api/upload/sign-media ────────────────────────────────────────────
  // Returns a signed Cloudinary payload for browser-direct image or video upload.
  // resourceType = "image" (max 8 MB) | "video" (max 25 MB)
  app.get<{ Querystring: { type?: string } }>(
    '/api/upload/sign-media',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const resourceType = req.query.type === 'video' ? 'video' : 'image';
      const folder       = resourceType === 'video' ? 'deep/media/videos' : 'deep/media/images';

      const timestamp = Math.round(Date.now() / 1000);

      const paramsToSign: Record<string, string | number> = { timestamp, folder };

      // Transformations — auto quality + format for images; keep original for video
      if (resourceType === 'image') {
        paramsToSign.transformation = 'f_webp,q_auto:good';
      }

      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET ?? '',
      );

      return reply.send({
        signature,
        timestamp,
        folder,
        resource_type: resourceType,
        api_key:       process.env.CLOUDINARY_API_KEY,
        cloud_name:    process.env.CLOUDINARY_CLOUD_NAME,
        // Client enforces these limits before even calling this endpoint
        max_bytes:     resourceType === 'video' ? 25 * 1024 * 1024 : 8 * 1024 * 1024,
      });
    },
  );
}
