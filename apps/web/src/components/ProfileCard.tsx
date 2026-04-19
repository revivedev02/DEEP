import { useEffect, useRef } from 'react';
import { useProfileCardStore } from '@/store/useProfileCardStore';
import { useDMStore }          from '@/store/useDMStore';
import { useUIStore }          from '@/store/useUIStore';
import { useAuthStore }        from '@/store/useAuthStore';
import { LazyAvatar }          from '@/components/LazyAvatar';
import { MessageSquare, ShieldCheck } from 'lucide-react';

const CARD_W  = 220;
const CARD_H  = 250;
const OFFSET  = 12;

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

  // ── Position ──
  const spaceRight = window.innerWidth - rect.right;
  const goLeft     = spaceRight < CARD_W + OFFSET + 16;
  let left = goLeft ? rect.left - CARD_W - OFFSET : rect.right + OFFSET;
  let top  = rect.top;
  if (top + CARD_H > window.innerHeight - 16) top = window.innerHeight - CARD_H - 16;
  if (top < 8) top = 8;

  // ── Message button: find existing DM or create one, then open it ──
  const handleMessage = async () => {
    close();
    const token = useAuthStore.getState().token;
    if (!token) return;

    // Check if conversation already exists locally
    const existing = useDMStore.getState().conversations.find(
      (c) => c.partner?.id === user.id
    );
    if (existing) {
      useUIStore.getState().setActiveDmConversation(existing.id);
      return;
    }

    // Create new conversation via API
    try {
      const res = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: user.id }),
      });
      if (!res.ok) return;
      const conv = await res.json();
      useDMStore.getState().upsertConversation(conv);
      useUIStore.getState().setActiveDmConversation(conv.id);
    } catch { /* silent fail */ }
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
        {/* Banner — real bannerUrl only, brand gradient CSS fallback if none */}
        <div className="profile-card-banner">
          {user.bannerUrl && (
            <img
              src={user.bannerUrl}
              alt=""
              className="profile-card-banner-img"
              draggable={false}
            />
          )}
        </div>

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
