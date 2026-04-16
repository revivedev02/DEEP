import { useState } from 'react';

const COLORS = [
  'bg-brand', 'bg-purple-600', 'bg-green-600',
  'bg-orange-500', 'bg-pink-600', 'bg-cyan-600', 'bg-yellow-600',
];

interface LazyAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;          // Tailwind size unit: 8 = w-8 h-8 (2rem)
  shape?: 'circle' | 'rounded';
  className?: string;
}

/**
 * Unified avatar component used everywhere in the app.
 * - Shows a skeleton while the image loads
 * - Falls back gracefully to a colored letter avatar on error or no URL
 */
export function LazyAvatar({ name, avatarUrl, size = 8, shape = 'circle', className = '' }: LazyAvatarProps) {
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const color  = COLORS[name.charCodeAt(0) % COLORS.length];
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const dim    = `w-${size} h-${size}`;

  if (!avatarUrl) {
    return (
      <div className={`${dim} ${radius} ${color} flex items-center justify-center text-white font-semibold flex-shrink-0 select-none ${className}`}
        style={{ fontSize: size >= 10 ? 16 : size >= 8 ? 13 : 11 }}>
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div className={`${dim} ${radius} overflow-hidden flex-shrink-0 relative ${className}`}>
      {/* Skeleton shown while loading */}
      {imgState === 'loading' && (
        <div className={`absolute inset-0 ${radius} skeleton`} />
      )}
      {/* Fallback letter on error */}
      {imgState === 'error' && (
        <div className={`absolute inset-0 ${radius} ${color} flex items-center justify-center text-white font-semibold`}
          style={{ fontSize: size >= 10 ? 16 : size >= 8 ? 13 : 11 }}>
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <img
        src={avatarUrl}
        alt={name}
        className={`w-full h-full object-cover transition-opacity duration-200 ${imgState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setImgState('loaded')}
        onError={() => setImgState('error')}
      />
    </div>
  );
}
