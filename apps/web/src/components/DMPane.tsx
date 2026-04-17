import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Reply, X } from 'lucide-react';
import { LazyAvatar } from '@/components/LazyAvatar';
import { MessageInput } from '@/components/MessageInput';
import { MessageItem } from '@/components/MessageItem';
import { SkMessageList } from '@/components/Skeleton';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { useDMStore, type DMMessage } from '@/store/useDMStore';
import { useAuthStore } from '@/store/useAuthStore';
import { isTodayIST, isYesterdayIST, isSameAuthorWithin5Min, IST } from './messageUtils';

// ── DMMessage → ChatMessage adapter ──────────────────────────────────────────
function dmToChatMsg(m: DMMessage) {
  return {
    ...m,
    channelId: m.conversationId,
    pinned: false,
    reactions: m.reactions ?? [],
    replyToId: m.replyToId ?? null,
    replyTo: m.replyTo
      ? { ...m.replyTo, channelId: m.conversationId, pinned: false, reactions: [], replyToId: null, replyTo: null, editedAt: null, createdAt: '' }
      : null,
  };
}

// ── Date divider ──────────────────────────────────────────────────────────────
function DateDivider({ label }: { label: string }) {
  const line = { flex: 1, height: '1px', background: 'rgb(var(--separator-rgb) / 0.5)' } as React.CSSProperties;
  return (
    <div className="flex items-center gap-3 px-4 my-5 select-none">
      <div style={line} />
      <span className="text-xs font-medium text-text-muted whitespace-nowrap tracking-wide">{label}</span>
      <div style={line} />
    </div>
  );
}

interface DMPaneProps {
  conversationId: string;
  partner: { id: string; displayName: string; username: string; avatarUrl?: string | null; isAdmin: boolean } | null;
  onSend:   (content: string, replyToId?: string) => void;
  onEdit:   (messageId: string, content: string) => void;
  onTyping: (typing: boolean) => void;
  onLoadOlder: () => void;
  showPinnedPanel?: boolean;
  onClosePinned?: () => void;
}

export default function DMPane({ conversationId, partner, onSend, onEdit, onTyping, onLoadOlder, showPinnedPanel, onClosePinned }: DMPaneProps) {
  const { messages, isLoading, isLoadingOlder, hasMore, typingUsers } = useDMStore();
  const { user, token } = useAuthStore();

  const scrollRef    = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // ── Reply state ────────────────────────────────────────────────────────────
  const [replyingTo, setReplyingTo] = useState<DMMessage | null>(null);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Reaction picker ────────────────────────────────────────────────────────
  const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<DMMessage | null>(null);
  const SKIP_KEY = 'deep:deleteNoConfirm';

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevCount = prevCountRef.current;
    const delta = messages.length - prevCount;
    if (delta === 1) el.scrollTop = el.scrollHeight;           // new message → scroll bottom
    else if (delta > 1 && prevCount > 0) {                     // prepend → anchor
      const anchorMsg = messages[delta];
      if (anchorMsg) {
        const msgEl = document.getElementById(`msg-${anchorMsg.id}`);
        if (msgEl) requestAnimationFrame(() => msgEl.scrollIntoView({ block: 'start' }));
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 100 && hasMore && !isLoadingOlder) onLoadOlder();
  }, [hasMore, isLoadingOlder, onLoadOlder]);

  // ── Group messages ─────────────────────────────────────────────────────────
  type Group = { dateLabel: string | null; msg: ReturnType<typeof dmToChatMsg>; isFirst: boolean };
  const groups = useMemo<Group[]>(() => {
    const result: Group[] = [];
    let lastDate = '';
    messages.forEach((msg, i) => {
      const d = new Date(msg.createdAt);
      const dateLabel = isTodayIST(d) ? 'Today'
                      : isYesterdayIST(d) ? 'Yesterday'
                      : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: IST }).format(d);
      const showDate = dateLabel !== lastDate;
      if (showDate) lastDate = dateLabel;
      const prev    = messages[i - 1];
      const isFirst = !prev || !isSameAuthorWithin5Min(prev, msg) || showDate;
      result.push({ dateLabel: showDate ? dateLabel : null, msg: dmToChatMsg(msg), isFirst });
    });
    return result;
  }, [messages]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSend = useCallback((content: string) => {
    onSend(content, replyingTo?.id);
    setReplyingTo(null);
  }, [onSend, replyingTo]);

  const handleDelete = useCallback((id: string) => {
    if (localStorage.getItem(SKIP_KEY) === 'true') {
      doDelete(id);
      return;
    }
    const msg = useDMStore.getState().messages.find(m => m.id === id);
    if (msg) setDeleteTarget(msg);
  }, []);

  const doDelete = useCallback(async (id: string) => {
    if (!token) return;
    useDMStore.getState().applyDelete(id);
    try {
      await fetch(`/api/dm/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* already removed optimistically */ }
  }, [token]);

  const handleModalConfirm = useCallback((dontAskAgain: boolean) => {
    if (!deleteTarget) return;
    if (dontAskAgain) localStorage.setItem(SKIP_KEY, 'true');
    doDelete(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, doDelete]);

  const handleStartEdit  = useCallback((id: string) => setEditingId(id), []);
  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  const handleSaveEdit = useCallback((id: string, content: string) => {
    setEditingId(null);
    // Optimistic update + socket broadcast (server saves + emits to partner)
    useDMStore.getState().applyEdit(id, content, new Date().toISOString());
    onEdit(id, content);
  }, [onEdit]);

  const handleReact = useCallback(async (msgId: string, emoji: string) => {
    if (!token) return;
    const current = useDMStore.getState().messages.find(m => m.id === msgId);
    if (current) {
      const userId = user?.id ?? '';
      const already = current.reactions?.some(r => r.emoji === emoji && r.userId === userId);
      const next = already
        ? (current.reactions ?? []).filter(r => !(r.emoji === emoji && r.userId === userId))
        : [...(current.reactions ?? []), { emoji, userId }];
      useDMStore.getState().applyReaction(msgId, next);
    }
    try {
      const res = await fetch(`/api/dm/messages/${msgId}/reactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const { reactions } = await res.json();
        useDMStore.getState().applyReaction(msgId, reactions);
      }
    } catch { /* keep optimistic */ }
  }, [token, user?.id]);

  const handleReply = useCallback((msg: DMMessage) => setReplyingTo(msg), []);
  const handleOpenReactionPicker  = useCallback((id: string) => setReactingMsgId(id), []);
  const handleCloseReactionPicker = useCallback(() => setReactingMsgId(null), []);

  const handlePin = useCallback(async (msg: { id: string; pinned: boolean }) => {
    if (!token) return;
    const newPinned = !msg.pinned;
    // Optimistic update
    useDMStore.getState().applyPinToggle(msg.id, newPinned);
    try {
      const res = await fetch(`/api/dm/messages/${msg.id}/pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('pin failed');
    } catch {
      // Rollback
      useDMStore.getState().applyPinToggle(msg.id, msg.pinned);
    }
  }, [token]);

  const noop = useCallback(() => {}, []);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* DM conversation start banner */}
        {!hasMore && (
          <div className="px-6 pt-8 pb-4 flex-shrink-0">
            <LazyAvatar name={partner?.displayName ?? '?'} avatarUrl={partner?.avatarUrl} size={20} />
            <h2 className="text-2xl font-bold text-text-normal mt-4 mb-1">{partner?.displayName}</h2>
            <p className="text-text-muted text-sm">
              This is the beginning of your direct message history with{' '}
              <strong className="text-text-normal">@{partner?.username}</strong>.
            </p>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="messages-container scrollbar-thin" onScroll={handleScroll}>
          {isLoading ? <SkMessageList /> : (
            <>
              {isLoadingOlder && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {groups.map(({ dateLabel, msg, isFirst }) => (
                <div key={msg.id}>
                  {dateLabel && <DateDivider label={dateLabel} />}
                  <MessageItem
                    msg={msg}
                    isFirst={isFirst}
                    currentUserId={user?.id ?? ''}
                    isAdmin={user?.isAdmin ?? false}
                    onDelete={handleDelete}
                    onReply={() => handleReply(useDMStore.getState().messages.find(m => m.id === msg.id)!)}
                    onPin={handlePin as any}
                    editingId={editingId}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    onReact={handleReact}
                    reactingMsgId={reactingMsgId}
                    onOpenReactionPicker={handleOpenReactionPicker}
                    onCloseReactionPicker={handleCloseReactionPicker}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Typing indicator */}
        <div className="typing-indicator">
          {typingUsers.length > 0 && (
            <>
              <div className="typing-dots">
                <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
              </div>
              <span><strong>{typingUsers[0]}</strong> is typing…</span>
            </>
          )}
        </div>

        {/* Reply banner */}
        {replyingTo && (
          <div className="reply-banner">
            <Reply className="w-4 h-4 text-brand flex-shrink-0" />
            <span className="reply-banner-text">
              Replying to <strong className="text-text-normal">{replyingTo.user.displayName}</strong>
              <span className="ml-2 text-text-muted truncate max-w-xs inline-block align-bottom">{replyingTo.content}</span>
            </span>
            <button
              className="ml-auto p-1 rounded hover:bg-bg-modifier text-text-muted hover:text-text-normal transition-colors"
              onClick={() => setReplyingTo(null)}
              title="Cancel reply (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <MessageInput
          onSend={handleSend}
          channelName={partner?.displayName ?? 'user'}
          onTyping={onTyping}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>

      {/* DM Pinned Messages Panel */}
      {showPinnedPanel && (
        <div className="pins-panel">
          <div className="pins-panel-header">
            <span className="text-sm font-semibold text-text-normal">Pinned Messages</span>
            <button
              className="text-text-muted hover:text-text-normal transition-colors p-1 rounded"
              onClick={onClosePinned}
              title="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {messages.filter(m => m.pinned).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <span className="text-4xl mb-3">📌</span>
                <p className="text-sm font-medium text-text-normal mb-1">No pins yet</p>
                <p className="text-xs text-text-muted">Hover a message and click the pin icon to pin it.</p>
              </div>
            ) : (
              <div className="divide-y divide-separator/20">
                {messages.filter(m => m.pinned).map(m => (
                  <div
                    key={m.id}
                    className="p-3 hover:bg-bg-hover cursor-pointer transition-colors"
                    onClick={() => { const el = document.getElementById(`msg-${m.id}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); onClosePinned?.(); }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-text-normal">{m.user.displayName}</span>
                      <span className="text-xs text-text-muted">{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-text-muted line-clamp-2">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          authorName={deleteTarget.user.displayName}
          preview={deleteTarget.content}
          onConfirm={handleModalConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
