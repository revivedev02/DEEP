import { useRef, useState } from 'react';
import { Upload, X, Camera, CheckCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface Props { onClose: () => void; }

export default function AvatarUploadModal({ onClose }: Props) {
  const { user, token, updateAvatar } = useAuthStore();
  const [preview, setPreview]   = useState<string | null>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [status, setStatus]     = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg]     = useState('');
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErrMsg('File too large (max 10 MB)'); return; }
    if (!f.type.startsWith('image/')) { setErrMsg('Please select an image file'); return; }
    setErrMsg('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus('idle');
  };

  const handleUpload = async () => {
    if (!file || !token) return;
    setStatus('uploading');
    setProgress(0);
    setErrMsg('');

    try {
      // 1. Get signed upload params from our server
      const signRes = await fetch('/api/upload/sign', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!signRes.ok) throw new Error('Failed to get upload signature');
      const { signature, timestamp, folder, transformation, api_key, cloud_name } = await signRes.json();

      // 2. Upload directly to Cloudinary from the browser
      const fd = new FormData();
      fd.append('file',           file);
      fd.append('api_key',        api_key);
      fd.append('timestamp',      String(timestamp));
      fd.append('signature',      signature);
      fd.append('folder',         folder);
      fd.append('transformation', transformation);

      // XHR for progress tracking
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90));
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            resolve(data.secure_url);
          } else {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err?.error?.message ?? `Cloudinary ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });

      setProgress(95);

      // 3. Save URL to our server
      const saveRes = await fetch('/api/upload/avatar', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!saveRes.ok) throw new Error('Failed to save avatar URL');

      setProgress(100);
      updateAvatar(url);
      setStatus('done');
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setErrMsg(e.message ?? 'Upload failed');
      setStatus('error');
    }
  };

  const initials = user?.displayName?.slice(0, 1).toUpperCase() ?? '?';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-secondary border border-separator/30 rounded-xl shadow-elevation-high w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-separator/30">
          <h2 className="text-base font-semibold text-text-normal">Change Avatar</h2>
          <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text-normal hover:bg-bg-modifier transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar preview */}
        <div className="px-5 py-6 flex flex-col items-center gap-4">
          <div
            className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer group ring-2 ring-brand/30 hover:ring-brand transition-all duration-150"
            onClick={() => inputRef.current?.click()}
          >
            {preview || user?.avatarUrl ? (
              <img src={preview ?? user?.avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-brand flex items-center justify-center text-white text-3xl font-bold">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>

          <p className="text-xs text-text-muted text-center">
            Click the avatar to select an image<br />
            <span className="text-text-muted/70">JPG, PNG, GIF, WebP · Max 10 MB</span>
          </p>

          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          {/* Upload progress bar */}
          {status === 'uploading' && (
            <div className="w-full bg-bg-modifier rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-brand transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {errMsg && (
            <p className="text-xs text-status-red bg-status-red/10 px-3 py-1.5 rounded w-full text-center">
              {errMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5 border-t border-separator/20 pt-3">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button
            onClick={handleUpload}
            disabled={!file || status === 'uploading' || status === 'done'}
            className="btn btn-primary btn-sm flex items-center gap-1.5 min-w-[100px] justify-center"
          >
            {status === 'uploading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {status === 'done'      && <CheckCircle className="w-3.5 h-3.5" />}
            {status === 'idle' || status === 'error' ? <Upload className="w-3.5 h-3.5" /> : null}
            {status === 'uploading' ? `${progress}%` : status === 'done' ? 'Done!' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
