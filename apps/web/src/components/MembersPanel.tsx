import { useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useMembersStore } from '@/store/useMembersStore';
import { LazyAvatar } from '@/components/LazyAvatar';

export default function MembersPanel() {
  const { onlineUsers } = useChatStore();
  const { token, user: me } = useAuthStore();
  const { members, setMembers } = useMembersStore();

  useEffect(() => {
    if (!token) return;
    fetch('/api/members', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]));
  }, [token]);

  const online  = members.filter(m => onlineUsers.has(m.id) || m.id === me?.id);
  const offline = members.filter(m => !onlineUsers.has(m.id) && m.id !== me?.id);

  return (
    <aside className="members-panel animate-fade-in">
      {/* Online */}
      {online.length > 0 && (
        <>
          <div className="member-section-title">Online — {online.length}</div>
          {online.map(m => (
            <div key={m.id} className="member-item">
              <div className="relative">
                <LazyAvatar name={m.displayName} avatarUrl={m.avatarUrl} size={8} />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-status-green border-2 border-bg-secondary" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`member-name font-medium truncate ${m.isAdmin ? 'text-brand' : ''}`}>
                  {m.displayName}
                  {m.isAdmin && (
                    <span className="ml-1.5 text-2xs bg-brand/20 text-brand px-1 py-0.5 rounded">ADMIN</span>
                  )}
                </span>
                <span className="text-xs text-text-muted truncate">#{m.username}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Offline */}
      {offline.length > 0 && (
        <>
          <div className="member-section-title mt-4">Offline — {offline.length}</div>
          {offline.map(m => (
            <div key={m.id} className="member-item opacity-50">
              <div className="relative">
                <LazyAvatar name={m.displayName} avatarUrl={m.avatarUrl} size={8} />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-text-muted border-2 border-bg-secondary" />
              </div>
              <span className="member-name truncate">{m.displayName}</span>
            </div>
          ))}
        </>
      )}

      {members.length === 0 && (
        <div className="px-4 mt-4 text-xs text-text-muted">Loading members…</div>
      )}
    </aside>
  );
}
