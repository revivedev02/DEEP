import { useEffect, useRef } from 'react';
import { useProfileCardStore } from '@/store/useProfileCardStore';
import { useDMStore }          from '@/store/useDMStore';
import { useUIStore }          from '@/store/useUIStore';
import { LazyAvatar }          from '@/components/LazyAvatar';
import { MessageSquare, ShieldCheck } from 'lucide-react';

const CARD_W  = 268;
const CARD_H  = 250; // approximate, used for edge clamping
const OFFSET  = 12;  // gap from avatar

export function ProfileCard() {
  const { visible, user, rect, close } = useProfileCardStore();
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, close]);

  if (!visible || !user || !rect) return null;

  // ── Position: prefer right of avatar, flip left if too close to edge ──
  const spaceRight = window.innerWidth - rect.right;
  const goLeft     = spaceRight < CARD_W + OFFSET + 16;

  let left = goLeft
    ? rect.left - CARD_W - OFFSET
    : rect.right + OFFSET;

  // Clamp vertically so card doesn't fall off screen
  let top = rect.top;
  if (top + CARD_H > window.innerHeight - 16) {
    top = window.innerHeight - CARD_H - 16;
  }
  if (top < 8) top = 8;

  // ── Message button: open existing DM if found ──
  const handleMessage = () => {
    close();
    const conv = useDMStore.getState().conversations.find(
      (c) => c.partner?.id === user.id
    );
    if (conv) {
      useUIStore.getState().setActiveDmConversation(conv.id);
    }
  };

  return (
    // Backdrop — transparent clickable overlay to dismiss
    <div
      className="profile-card-backdrop"
      onClick={close}
      onContextMenu={close}
    >
      <div
        ref={cardRef}
        className="profile-card animate-scale-in"
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner — avatar shown cleanly, slight darken only */}
        <div
          className="profile-card-banner"
          style={user.avatarUrl ? {
            backgroundImage: `url(${user.avatarUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.75)',
          } : undefined}
        />

        {/* Avatar — overlaps banner/body boundary */}
        <div className="profile-card-avatar-ring">
          <LazyAvatar
            name={user.displayName}
            avatarUrl={user.avatarUrl}
            size={18}
          />
        </div>

        {/* Body */}
        <div className="profile-card-body">
          {/* Name row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="profile-card-name">{user.displayName}</span>
            {user.isAdmin && (
              <span className="profile-card-admin-badge">
                <ShieldCheck className="w-3 h-3" />
                Admin
              </span>
            )}
          </div>
          <span className="profile-card-username">@{user.username}</span>

          {/* Divider */}
          <div className="profile-card-divider" />

          {/* Message button */}
          <button className="profile-card-msg-btn" onClick={handleMessage}>
            <MessageSquare className="w-4 h-4" />
            Message
          </button>
        </div>
      </div>
    </div>
  );
}
