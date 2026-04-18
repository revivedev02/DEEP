import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  api_key:    process.env.CLOUDINARY_API_KEY    ?? '',
  api_secret: process.env.CLOUDINARY_API_SECRET ?? '',
});

// Log missing credentials at startup so Railway logs show the issue clearly
const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  .filter(k => !process.env[k]);
if (missing.length) console.warn(`⚠️  Cloudinary: missing env vars: ${missing.join(', ')}`);

/**
 * Upload a buffer to Cloudinary via stream and return the secure URL.
 */
export async function uploadImage(
  buffer: Buffer,
  folder: string,
  publicId?: string,
  options?: Record<string, unknown>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:      publicId,
        overwrite:      true,
        resource_type:  'image',
        transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face', format: 'webp', quality: 'auto:best' }],
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No result from Cloudinary'));
        resolve(result.secure_url);
      },
    );
    uploadStream.end(buffer);
  });
}

/**
 * Extract the Cloudinary public_id from a secure URL and delete it.
 * Errors are silently swallowed — a failed delete must never block the caller.
 *
 * Example URL:
 *   https://res.cloudinary.com/mycloud/image/upload/v1234567890/deep/avatars/abc123.webp
 * Extracted public_id:
 *   deep/avatars/abc123
 */
export async function destroyImage(url: string | null | undefined): Promise<void> {
  if (!url || !url.includes('cloudinary.com')) return;

  try {
    // Strip everything up to and including "/upload/", then strip optional version segment,
    // then strip the file extension to get the bare public_id.
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^./]+)?$/);
    if (!match) return;

    const publicId = match[1]; // e.g. "deep/avatars/abc123"
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    console.log(`🗑️  Cloudinary: deleted old asset "${publicId}"`);
  } catch (err) {
    // Non-fatal — log for visibility but don't surface to the user
    console.warn('⚠️  Cloudinary: failed to delete old asset:', err);
  }
}
