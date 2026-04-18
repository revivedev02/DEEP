/**
 * uploadMedia — client-side media upload to Cloudinary via signed direct upload.
 *
 * Flow:
 *   1. Validate file type + size locally (fail fast, no network needed)
 *   2. Fetch a short-lived signed payload from our backend
 *   3. POST the file directly to Cloudinary (never hits our server)
 *   4. Return { url, type }
 */

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];

const MAX_IMAGE_BYTES = 8  * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

export type MediaType = 'image' | 'video';

export interface UploadedMedia {
  url:  string;
  type: MediaType;
}

export function validateMediaFile(file: File): string | null {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return 'Unsupported file type. Upload images (JPG, PNG, GIF, WebP) or videos (MP4, WebM, MOV).';
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return `Image too large. Max size is 8 MB (yours: ${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return `Video too large. Max size is 25 MB (yours: ${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  return null;
}

export async function uploadMedia(file: File, token: string): Promise<UploadedMedia> {
  const isVideo    = VIDEO_TYPES.includes(file.type);
  const mediaType: MediaType = isVideo ? 'video' : 'image';

  // Validate before hitting the network
  const err = validateMediaFile(file);
  if (err) throw new Error(err);

  // 1. Get signed payload from our server
  const signRes = await fetch(`/api/upload/sign-media?type=${mediaType}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!signRes.ok) throw new Error('Failed to get upload signature.');
  const sign = await signRes.json() as {
    signature: string;
    timestamp:     number;
    folder:        string;
    resource_type: string;
    api_key:       string;
    cloud_name:    string;
  };

  // 2. POST file directly to Cloudinary
  const form = new FormData();
  form.append('file',      file);
  form.append('api_key',   sign.api_key);
  form.append('timestamp', String(sign.timestamp));
  form.append('signature', sign.signature);
  form.append('folder',    sign.folder);
  if (mediaType === 'image') form.append('transformation', 'f_webp,q_auto:good');

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${sign.cloud_name}/${sign.resource_type}/upload`,
    { method: 'POST', body: form }
  );

  if (!uploadRes.ok) {
    const body = await uploadRes.json().catch(() => ({})) as { error?: { message: string } };
    throw new Error(body.error?.message ?? 'Cloudinary upload failed.');
  }

  const result = await uploadRes.json() as { secure_url: string };
  return { url: result.secure_url, type: mediaType };
}
