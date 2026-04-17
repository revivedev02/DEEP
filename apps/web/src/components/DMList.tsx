import { useEffect, useState } from 'react';
import { MessageSquarePlus, X } from 'lucide-react';
import { LazyAvatar } from '@/components/LazyAvatar';
import { useDMStore, type DMConversation } from '@/store/useDMStore';
import { useMembersStore } from '@/store/useMembersStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';

// ── New DM picker modal ────────────────────────────────────────────────────────
function NewDMModal({ onClose, onStart }: { onClose: () => void; onStart: (userId: string) => void }) {
  const { members } = useMembersStore();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const others = members.filter(m =>
    m.id !== user?.id &&
    (query === '' ||
      m.displayName.toLowerCase().includes(query.toLowerCase()) ||
      m.username.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
        <div
          className="bg-bg-secondary rounded-xl shadow-elevation-high w-80 flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-separator">
            <span className="font-semibold text-text-normal">New Direct Message</span>
            <button onClick={onClose} className="text-text-muted hover:text-text-normal transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-3 py-2 border-b border-separator">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search members…"
              className="w-full bg-bg-primary text-sm text-text-normal placeholder:text-text-muted rounded-lg px-3 py-2 outline-none"
            />
          </div>
          <div className="overflow-y-auto max-h-64 py-1">
            {others.length === 0 ? (
              <p className="text-center text-sm text-text-muted py-6">No members found</p>
            ) : (
              others.map(m => (
                <button
                  key={m.id}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-hover transition-colors text-left"
                  onClick={() => { onStart(m.id); onClose(); }}
                >
                  <LazyAvatar name={m.displayName} avatarUrl={m.avatarUrl} size={8} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-text-normal truncate">{m.displayName}</span>
                    <span className="text-xs text-text-muted">@{m.username}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── DM conversation row ────────────────────────────────────────────────────────
function DMRow({ conv, active, onSelect }: { conv: DMConversation; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-150 text-left
        ${active ? 'bg-bg-active text-text-normal' : 'text-text-muted hover:bg-bg-hover hover:text-text-normal'}`}
    >
      <div className="relative flex-shrink-0">
        <LazyAvatar name={conv.partner?.displayName ?? '?'} avatarUrl={conv.partner?.avatarUrl} size={8} />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-medium text-text-normal truncate">{conv.partner?.displayName ?? 'Unknown'}</span>
        {conv.lastMessage && (
          <span className="text-xs text-text-muted truncate">{conv.lastMessage.content}</span>
        )}
      </div>
    </button>
  );
}

// ── Main DM list ──────────────────────────────────────────────────────────────
interface DMListProps {
  activeDmId: string | null;
  onSelectDM: (conv: DMConversation) => void;
}

export function DMList({ activeDmId, onSelectDM }: DMListProps) {
  const { conversations, setConversations, upsertConversation } = useDMStore();
  const { token } = useAuthStore();
  const [showNewDM, setShowNewDM] = useState(false);

  // Load conversations
  useEffect(() => {
    if (!token) return;
    fetch('/api/dm/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setConversations(data); })
      .catch(() => {});
  }, [token]);

  const handleStartDM = async (targetUserId: string) => {
    if (!token) return;
    const res = await fetch('/api/dm/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });
    if (!res.ok) return;
    const conv = await res.json();
    upsertConversation(conv);
    onSelectDM(conv);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Direct Messages</span>
        <button
          onClick={() => setShowNewDM(true)}
          className="text-text-muted hover:text-text-normal transition-colors"
          title="New direct message"
        >
          <MessageSquarePlus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-1">
        {conversations.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-text-muted">No DMs yet.</p>
            <button
              onClick={() => setShowNewDM(true)}
              className="mt-2 text-brand text-sm hover:underline"
            >
              Start a conversation →
            </button>
          </div>
        ) : (
          conversations.map(conv => (
            <DMRow
              key={conv.id}
              conv={conv}
              active={activeDmId === conv.id}
              onSelect={() => onSelectDM(conv)}
            />
          ))
        )}
      </div>

      {showNewDM && (
        <NewDMModal
          onClose={() => setShowNewDM(false)}
          onStart={handleStartDM}
        />
      )}
    </div>
  );
}
