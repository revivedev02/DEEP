import { useRef, useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Upload, X, CheckCircle, Loader2, ZoomIn, ZoomOut, ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface Props { onClose: () => void; }
interface CroppedArea { x: number; y: number; width: number; height: number; }

const ASPECT = 3; // 3:1 — matches Discord banner ratio

async function getCroppedBlob(src: string, crop: CroppedArea): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('No blob')), 'image/webp', 0.92)
  );
}

export default function BannerUploadModal({ onClose }: Props) {
  const { user, token, updateBanner } = useAuthStore();

  const [step, setStep]               = useState<'select' | 'crop' | 'upload'>('select');
  const [imageSrc, setImageSrc]       = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);

  const [crop, setCrop]   = useState({ x: 0, y: 0 });
  const [zoom, setZoom]   = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);

  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg]     = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErrMsg('Please select an image file'); return; }
    if (f.size > 20 * 1024 * 1024)   { setErrMsg('Max 20 MB'); return; }
    setErrMsg('');
    setImageSrc(URL.createObjectURL(f));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setStep('crop');
  };

  const onCropComplete = useCallback((_: unknown, pixels: CroppedArea) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
    setCroppedBlob(blob);
    setCroppedPreview(URL.createObjectURL(blob));
    setStep('upload');
  };

  const handleUpload = async () => {
    if (!croppedBlob || !token) return;
    setStatus('uploading'); setProgress(0); setErrMsg('');
    try {
      const signRes = await fetch('/api/upload/sign-banner', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!signRes.ok) throw new Error('Failed to get upload signature');
      const { signature, timestamp, folder, transformation, api_key, cloud_name } = await signRes.json();

      const fd = new FormData();
      fd.append('file',           croppedBlob, 'banner.webp');
      fd.append('api_key',        api_key);
      fd.append('timestamp',      String(timestamp));
      fd.append('signature',      signature);
      fd.append('folder',         folder);
      fd.append('transformation', transformation);

      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90));
        };
        xhr.onload = () => {
          if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url);
          else reject(new Error(JSON.parse(xhr.responseText)?.error?.message ?? `Error ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });

      setProgress(95);
      const saveRes = await fetch('/api/upload/banner', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!saveRes.ok) throw new Error('Failed to save banner');
      setProgress(100);
      updateBanner(url);
      setStatus('done');
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setErrMsg(e.message ?? 'Upload failed');
      setStatus('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="border border-separator/30 shadow-elevation-high w-full mx-4"
        style={{
          maxWidth: step === 'crop' ? 600 : 420,
          background: 'var(--card-bg)',
          borderRadius: 'var(--card-radius)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-separator/30">
          <h2 className="text-base font-semibold text-text-normal">
            {step === 'select' ? 'Change Banner' : step === 'crop' ? 'Crop Banner' : 'Upload Banner'}
          </h2>
          <div className="flex items-center gap-2">
            {step === 'crop' && (
              <button
                onClick={() => setStep('select')}
                className="text-xs text-text-muted hover:text-text-normal px-2 py-1 rounded transition-colors"
                style={{ background: 'var(--bg-hover)' }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded text-text-muted hover:text-text-normal transition-colors"
              style={{ background: 'var(--bg-hover)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Step 1: Select ── */}
        {step === 'select' && (
          <div className="px-5 py-8 flex flex-col items-center gap-5">
            {/* Current banner preview or placeholder */}
            <div
              className="w-full rounded-lg overflow-hidden cursor-pointer group relative"
              style={{ height: 120, background: 'var(--bg-secondary)' }}
              onClick={() => inputRef.current?.click()}
            >
              {user?.bannerUrl ? (
                <img src={user.bannerUrl} alt="Current banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-text-muted">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                  <span className="text-xs">No banner set</span>
                </div>
              )}
              {/* Hover overlay */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.55)' }}
              >
                <Upload className="w-6 h-6 text-white" />
                <span className="text-white text-xs font-medium">Upload Banner</span>
              </div>
            </div>

            <p className="text-xs text-text-muted text-center">
              Recommended size: <span className="text-text-normal">1500 × 500px</span><br />
              <span className="opacity-60">JPG, PNG, WebP · Max 20 MB</span>
            </p>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {errMsg && <p className="text-xs text-red-400">{errMsg}</p>}
            <button
              onClick={() => inputRef.current?.click()}
              className="btn btn-primary btn-sm w-full"
            >
              <Upload className="w-3.5 h-3.5" /> Select Image
            </button>
          </div>
        )}

        {/* ── Step 2: Crop ── */}
        {step === 'crop' && imageSrc && (
          <div>
            {/* Crop canvas — tall enough for landscape ratio */}
            <div className="relative bg-black" style={{ height: 240 }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={ASPECT}
                showGrid={true}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: { borderRadius: 0 },
                  cropAreaStyle: {
                    border: '2px solid rgba(88,101,242,0.9)',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                  },
                }}
              />
            </div>

            {/* Controls */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="range" min={1} max={3} step={0.01} value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-brand h-1 cursor-pointer"
                />
                <ZoomIn className="w-4 h-4 text-text-muted flex-shrink-0" />
              </div>
              <div className="flex items-center justify-end">
                <button onClick={handleApplyCrop} className="btn btn-primary btn-sm">
                  Apply Crop →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Upload ── */}
        {step === 'upload' && (
          <div className="px-5 py-6 flex flex-col items-center gap-4">
            {/* Cropped preview */}
            <div className="w-full rounded-lg overflow-hidden" style={{ height: 110 }}>
              {croppedPreview && (
                <img src={croppedPreview} alt="Banner preview" className="w-full h-full object-cover" />
              )}
            </div>
            <p className="text-xs text-text-muted">Looking good! Click Upload to save.</p>

            {status === 'uploading' && (
              <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--bg-modifier)' }}>
                <div
                  className="h-full bg-brand transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {errMsg && <p className="text-xs text-red-400 text-center">{errMsg}</p>}

            <div className="flex gap-2 w-full">
              <button onClick={() => setStep('crop')} className="btn btn-ghost btn-sm flex-1">← Re-crop</button>
              <button
                onClick={handleUpload}
                disabled={status === 'uploading' || status === 'done'}
                className="btn btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5"
              >
                {status === 'uploading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {status === 'done'      && <CheckCircle className="w-3.5 h-3.5" />}
                {(status === 'idle' || status === 'error') && <Upload className="w-3.5 h-3.5" />}
                {status === 'uploading' ? `${progress}%` : status === 'done' ? 'Done!' : 'Upload'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
