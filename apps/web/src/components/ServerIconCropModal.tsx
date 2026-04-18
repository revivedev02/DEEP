import { useRef, useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Upload, X, Check, Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useServerStore } from '@/store/useServerStore';

interface Props { onClose: () => void; }
interface CroppedArea { x: number; y: number; width: number; height: number; }

async function getCroppedBlob(imageSrc: string, crop: CroppedArea): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = crop.width; canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('No blob')), 'image/webp', 0.92));
}

export default function ServerIconCropModal({ onClose }: Props) {
  const { token } = useAuthStore();
  const { serverName, iconUrl, setIconUrl } = useServerStore();

  const [step, setStep]               = useState<'select' | 'crop' | 'upload'>('select');
  const [imageSrc, setImageSrc]       = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [preview, setPreview]         = useState<string | null>(null);

  const [crop, setCrop]       = useState({ x: 0, y: 0 });
  const [zoom, setZoom]       = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);

  const [status, setStatus]     = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    setImageSrc(URL.createObjectURL(f));
    setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0);
    setStep('crop');
  };

  const onCropComplete = useCallback((_: unknown, pixels: CroppedArea) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
    setCroppedBlob(blob);
    setPreview(URL.createObjectURL(blob));
    setStep('upload');
  };

  const handleUpload = async () => {
    if (!croppedBlob || !token) return;
    setStatus('uploading'); setProgress(0); setErrMsg('');
    try {
      const signRes = await fetch('/api/upload/sign-server-icon', { headers: { Authorization: `Bearer ${token}` } });
      if (!signRes.ok) throw new Error('Failed to get signature');
      const { signature, timestamp, folder, transformation, api_key, cloud_name } = await signRes.json();

      const fd = new FormData();
      fd.append('file', croppedBlob, 'icon.webp');
      fd.append('api_key', api_key); fd.append('timestamp', String(timestamp));
      fd.append('signature', signature); fd.append('folder', folder);
      fd.append('transformation', transformation);

      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90)); };
        xhr.onload = () => xhr.status === 200
          ? resolve(JSON.parse(xhr.responseText).secure_url)
          : reject(new Error(JSON.parse(xhr.responseText)?.error?.message ?? `Error ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });

      setProgress(95);
      const saveRes = await fetch('/api/upload/server-icon', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!saveRes.ok) throw new Error('Failed to save icon');
      setIconUrl(url); setProgress(100); setStatus('done');
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setErrMsg(e.message ?? 'Upload failed'); setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="border border-separator/30 shadow-elevation-high w-full mx-4"
        style={{ maxWidth: step === 'crop' ? 480 : 360, background: 'var(--card-bg)', borderRadius: 'var(--card-radius)' }}>

        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-separator/30">
          <h2 className="text-base font-semibold text-text-normal">
            {step === 'select' ? 'Upload Server Icon' : step === 'crop' ? 'Crop Icon' : 'Save Icon'}
          </h2>
          <div className="flex items-center gap-2">
            {step === 'crop' && <button onClick={() => setStep('select')} className="text-xs text-text-muted hover:text-text-normal px-2 py-1 rounded hover:bg-bg-modifier">← Back</button>}
            <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text-normal hover:bg-bg-modifier"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {step === 'select' && (
          <div className="px-5 py-8 flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden cursor-pointer ring-2 ring-brand/30 hover:ring-brand transition-all"
              onClick={() => inputRef.current?.click()}>
              {iconUrl
                ? <img src={iconUrl} alt="Server icon" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-brand/20 flex items-center justify-center text-brand text-4xl font-bold">{serverName.slice(0, 1)}</div>}
            </div>
            <p className="text-xs text-text-muted text-center">Click to select an image<br /><span className="text-text-muted/60">JPG, PNG, WebP · Square crop will be applied</span></p>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button onClick={() => inputRef.current?.click()} className="btn btn-primary btn-sm">Select Image</button>
          </div>
        )}

        {step === 'crop' && imageSrc && (
          <div>
            <div className="relative bg-black" style={{ height: 320 }}>
              <Cropper image={imageSrc} crop={crop} zoom={zoom} rotation={rotation} aspect={1}
                cropShape="rect" showGrid={true} onCropChange={setCrop}
                onZoomChange={setZoom} onCropComplete={onCropComplete}
                style={{ containerStyle: { borderRadius: 0 }, cropAreaStyle: { border: '2px solid rgba(88,101,242,0.8)', borderRadius: 8 } }} />
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input type="range" min={1} max={3} step={0.01} value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand h-1 cursor-pointer" />
                <ZoomIn className="w-4 h-4 text-text-muted flex-shrink-0" />
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setRotation(r => (r + 90) % 360)} className="btn btn-ghost btn-sm flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5" /> Rotate
                </button>
                <button onClick={handleApplyCrop} className="btn btn-primary btn-sm">Apply Crop</button>
              </div>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="px-5 py-6 flex flex-col items-center gap-4">
            {preview && <img src={preview} alt="Preview" className="w-24 h-24 rounded-2xl object-cover ring-2 ring-brand/30" />}
            <p className="text-xs text-text-muted">Ready to upload as server icon.</p>
            {status === 'uploading' && (
              <div className="w-full bg-bg-modifier rounded-full h-1.5">
                <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
            {errMsg && <p className="text-xs text-status-red text-center">{errMsg}</p>}
            <div className="flex gap-2 w-full">
              <button onClick={() => setStep('crop')} className="btn btn-ghost btn-sm flex-1">← Re-crop</button>
              <button onClick={handleUpload} disabled={status === 'uploading' || status === 'done'}
                className="btn btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5">
                {status === 'uploading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {status === 'done' && <Check className="w-3.5 h-3.5" />}
                {status === 'uploading' ? `${progress}%` : status === 'done' ? 'Saved!' : <><Upload className="w-3.5 h-3.5" /> Upload</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
