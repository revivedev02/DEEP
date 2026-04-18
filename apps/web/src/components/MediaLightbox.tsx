import { useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface MediaLightboxProps {
  url:   string;
  type:  'image' | 'video';
  onClose: () => void;
}

export function MediaLightbox({ url, type, onClose }: MediaLightboxProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="media-lightbox"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div className="media-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="media-lightbox-btn"
          title="Open original"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href={url}
          download
          className="media-lightbox-btn"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </a>
        <button
          className="media-lightbox-btn"
          title="Close (Esc)"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Media */}
      <div className="media-lightbox-content" onClick={(e) => e.stopPropagation()}>
        {type === 'image' ? (
          <img
            src={url}
            alt="Full size"
            className="media-lightbox-img"
            draggable={false}
          />
        ) : (
          <video
            src={url}
            className="media-lightbox-video"
            controls
            autoPlay
          />
        )}
      </div>
    </div>
  );
}
