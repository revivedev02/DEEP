import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  api_key:    process.env.CLOUDINARY_API_KEY    ?? '',
  api_secret: process.env.CLOUDINARY_API_SECRET ?? '',
});

/**
 * Upload a buffer to Cloudinary and return the secure URL.
 * @param buffer  - Raw file buffer
 * @param folder  - Cloudinary folder ('avatars' | 'server')
 * @param publicId - Optional fixed public_id (for overwriting)
 * @param options  - Extra transform options
 */
export async function uploadImage(
  buffer: Buffer,
  folder: string,
  publicId?: string,
  options?: Record<string, unknown>,
): Promise<string> {
  const dataUri = `data:image/webp;base64,${buffer.toString('base64')}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id:       publicId,
    overwrite:       true,
    resource_type:   'image',
    transformation:  [{ width: 256, height: 256, crop: 'fill', gravity: 'face', format: 'webp', quality: 'auto' }],
    ...options,
  });

  return result.secure_url;
}
