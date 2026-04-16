import { useEffect, useRef } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

interface Props {
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel:  () => void;
  authorName: string;
  preview: string;
}

export default function DeleteConfirmModal({ onConfirm, onCancel, authorName, preview }: Props) {
  const checkRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleConfirm = () => {
    onConfirm(checkRef.current?.checked ?? false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="delete-modal animate-scale-in">
        {/* Header */}
        <div className="delete-modal-header">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-status-red/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-status-red" />
            </div>
            <h2 className="text-base font-semibold text-text-normal">Delete Message</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-text-muted hover:text-text-normal hover:bg-bg-modifier transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="delete-modal-body">
          <p className="text-sm text-text-muted mb-3">
            Are you sure you want to delete this message? This action{' '}
            <span className="text-text-normal font-medium">cannot be undone</span>.
          </p>

          {/* Message preview */}
          <div className="delete-modal-preview">
            <span className="text-xs font-semibold text-text-normal mb-0.5 block">{authorName}</span>
            <span className="text-sm text-text-muted line-clamp-2">{preview}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="delete-modal-footer">
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
            <input
              ref={checkRef}
              type="checkbox"
              className="accent-brand w-3.5 h-3.5 rounded cursor-pointer"
            />
            Don't ask again
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="btn btn-danger btn-sm flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
