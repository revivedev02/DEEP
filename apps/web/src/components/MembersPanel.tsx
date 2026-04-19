import { useEffect, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useMembersStore, type MemberEntry } from '@/store/useMembersStore';
import { useUIStore } from '@/store/useUIStore';
import { useDMStore } from '@/store/useDMStore';
import { LazyAvatar } from '@/components/LazyAvatar';
import { useProfileCardStore } from '@/store/useProfileCardStore';

// ── Member row ────────────────────────────────────────────────────────────────
function MemberRow({ m, isOnline, isMe, onDMClick }: {
  m: MemberEntry;
  isOnline: boolean;
  isMe: boolean;
  onDMClick: (m: MemberEntry) => void;
}) {
  return (
    <div
      className={`member-item group cursor-pointer ${!isOnline && !isMe ? 'opacity-50' : ''}`}
      onClick={() => !isMe && onDMClick(m)}
      title={isMe ? 'That\'s you!' : `Message ${m.displayName}`}
    >
      {/* Avatar — click opens profile card, doesn't trigger row DM click */}
      <div
        className="relative flex-shrink-0 avatar-btn"
        onClick={(e) => {
          e.stopPropagation();
          useProfileCardStore.getState().open(
            { id: m.id, displayName: m.displayName, username: m.username,
              avatarUrl: m.avatarUrl ?? null,
              bannerUrl: (m as any).bannerUrl ?? null,
              isAdmin: m.isAdmin },
            e.currentTarget.getBoundingClientRect()
          );
        }}
      >
        <LazyAvatar name={m.displayName} avatarUrl={m.avatarUrl} size={8} />
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-secondary
          ${isOnline || isMe ? 'bg-status-green' : 'bg-text-muted'}`}
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className={`member-name font-medium truncate ${m.isAdmin ? 'text-brand' : ''}`}>
          {m.displayName}
          {m.isAdmin && (
            <span className="ml-1.5 text-2xs bg-brand/20 text-brand px-1 py-0.5 rounded">ADMIN</span>
          )}
          {isMe && (
            <span className="ml-1.5 text-2xs bg-bg-modifier text-text-muted px-1 py-0.5 rounded">YOU</span>
          )}
        </span>
        <span className="text-xs text-text-muted truncate">@{m.username}</span>
      </div>
      {/* DM hint icon on hover */}
      {!isMe && (
        <MessageSquare className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MembersPanel() {
  const { onlineUsers } = useChatStore();
  const { token, user: me } = useAuthStore();
  const { members, setMembers } = useMembersStore();
  const { setActiveDmConversation } = useUIStore();

  useEffect(() => {
    if (!token) return;
    fetch('/api/members', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]));
  }, [token]);

  const online  = members.filter(m => onlineUsers.has(m.id) || m.id === me?.id);
  const offline = members.filter(m => !onlineUsers.has(m.id) && m.id !== me?.id);

  // Click member → open or create DM, switch to DMs tab
  const handleDMClick = useCallback(async (member: MemberEntry) => {
    if (!token) return;
    try {
      const res = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: member.id }),
      });
      if (!res.ok) return;
      const conv = await res.json();
      useDMStore.getState().upsertConversation(conv);
      setActiveDmConversation(conv.id);
    } catch {}
  }, [token, setActiveDmConversation]);

  return (
    <aside className="members-panel animate-fade-in">
      {/* Online */}
      {online.length > 0 && (
        <>
          <div className="member-section-title">Online — {online.length}</div>
          {online.map(m => (
            <MemberRow
              key={m.id}
              m={m}
              isOnline={true}
              isMe={m.id === me?.id}
              onDMClick={handleDMClick}
            />
          ))}
        </>
      )}

      {/* Offline */}
      {offline.length > 0 && (
        <>
          <div className="member-section-title mt-4">Offline — {offline.length}</div>
          {offline.map(m => (
            <MemberRow
              key={m.id}
              m={m}
              isOnline={false}
              isMe={false}
              onDMClick={handleDMClick}
            />
          ))}
        </>
      )}

      {members.length === 0 && (
        <div className="px-4 mt-4 text-xs text-text-muted">Loading members…</div>
      )}
    </aside>
  );
}
