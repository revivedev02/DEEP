import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { uploadImage } from '../lib/cloudinary.js';

export async function registerUploadRoutes(app: FastifyInstance) {

  // ── POST /api/upload/avatar ───────────────────────────────────────────────
  app.post(
    '/api/upload/avatar',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string };

      const data = await req.file();
      if (!data) return reply.code(400).send({ error: 'No file uploaded' });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 8 * 1024 * 1024)
        return reply.code(413).send({ error: 'File too large (max 8 MB)' });

      try {
        const avatarUrl = await uploadImage(buffer, 'deep/avatars', payload.sub);
        await prisma.user.update({ where: { id: payload.sub }, data: { avatarUrl } });
        return reply.send({ avatarUrl });
      } catch (err: any) {
        app.log.error(err, 'Cloudinary upload failed');
        return reply.code(500).send({
          error: 'Upload failed',
          detail: err?.message ?? String(err),
        });
      }
    },
  );

  // ── POST /api/upload/server-icon ─────────────────────────────────────────
  // Admin-only: Upload server icon, save to ServerSettings
  app.post(
    '/api/upload/server-icon',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string; isAdmin: boolean };
      if (!payload.isAdmin) return reply.code(403).send({ error: 'Forbidden' });

      const data = await req.file();
      if (!data) return reply.code(400).send({ error: 'No file uploaded' });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 8 * 1024 * 1024)
        return reply.code(413).send({ error: 'File too large (max 8 MB)' });

      const iconUrl = await uploadImage(buffer, 'deep/server', 'server-icon', {
        transformation: [{ width: 256, height: 256, crop: 'fill', format: 'webp', quality: 'auto' }],
      });

      await prisma.serverSettings.update({
        where: { id: 'main' },
        data:  { iconUrl },
      });

      return reply.send({ iconUrl });
    },
  );
}
