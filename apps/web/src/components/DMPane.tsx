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
import type { UploadedMedia } from '@/lib/uploadMedia';

// ── DMMessage → ChatMessage adapter ──────────────────────────────────────────
// IMPORTANT: preserve all real values — never hardcode pinned:false etc.
function dmToChatMsg(m: DMMessage) {
  return {
    ...m,
    channelId: m.conversationId,
    // pinned, reactions, replyToId spread from `...m`
    replyTo: m.replyTo
      ? {
          ...m.replyTo,
          channelId: m.conversationId,
          pinned: false,
          reactions: [],
          replyToId: null,
          replyTo: null,
          editedAt: null,
          createdAt: '',
        }
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
  // onSend must carry media so MessageInput's file upload flows through correctly
  onSend:   (content: string, media?: UploadedMedia, replyToId?: string) => void;
  onEdit:   (messageId: string, content: string) => void;
  onTyping: (typing: boolean) => void;
  onLoadOlder: () => void;
  showPinnedPanel?: boolean;
  onClosePinned?: () => void;
}

export default function DMPane({
  conversationId, partner, onSend, onEdit, onTyping, onLoadOlder,
  showPinnedPanel, onClosePinned,
}: DMPaneProps) {
  const { messages, isLoading, isLoadingOlder, hasMore, typingUsers } = useDMStore();
  const { user, token } = useAuthStore();

  const scrollRef    = useRef<HTMLDivElement>(null);
  const contentRef   = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // ── State ──────────────────────────────────────────────────────────────────
  const [replyingTo,   setReplyingTo]   = useState<DMMessage | null>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [reactingMsgId,setReactingMsgId]= useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DMMessage | null>(null);
  const SKIP_KEY = 'deep:deleteNoConfirm';

  // ── ResizeObserver: re-scroll when images load or reactions appear ─────────
  useEffect(() => {
    const content = contentRef.current;
    const scroll  = scrollRef.current;
    if (!content || !scroll) return;
    let lastH = scroll.scrollHeight;
    const observer = new ResizeObserver(() => {
      const newH = scroll.scrollHeight;
      if (newH <= lastH) { lastH = newH; return; }
      const distBefore = lastH - scroll.scrollTop - scroll.clientHeight;
      if (distBefore < 80) scroll.scrollTop = newH;
      lastH = newH;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // ── Auto-scroll: initial load, own send, single new msg, batch prepend ─────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevCount = prevCountRef.current;
    const delta = messages.length - prevCount;

    if (prevCount === 0 && delta > 0) {
      // Initial load — jump to bottom so the latest message is visible
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    } else if (delta === 1) {
      const lastMsg = messages[messages.length - 1];
      const isOwnMessage = !!lastMsg?.pending || lastMsg?.userId === user?.id;
      if (isOwnMessage) {
        // User sent a message (text or media) — always scroll to bottom
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
      } else {
        // Incoming from partner — only scroll if near bottom
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (dist < 300) el.scrollTop = el.scrollHeight;
      }
    } else if (delta > 1 && prevCount > 0) {
      // Batch prepend (load older) — anchor to first previously-visible message
      const anchorMsg = messages[delta];
      if (anchorMsg) {
        const msgEl = document.getElementById(`msg-${anchorMsg.id}`);
        if (msgEl) requestAnimationFrame(() => msgEl.scrollIntoView({ block: 'start' }));
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset reply/edit on conversation switch ────────────────────────────────
  useEffect(() => {
    setReplyingTo(null);
    setEditingId(null);
    setReactingMsgId(null);
  }, [conversationId]);

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 100 && hasMore && !isLoadingOlder) onLoadOlder();
  }, [hasMore, isLoadingOlder, onLoadOlder]);

  // ── Message groups (date + consecutive-author grouping) ───────────────────
  type Group = { dateLabel: string | null; msg: ReturnType<typeof dmToChatMsg>; isFirst: boolean };
  const groups = useMemo<Group[]>(() => {
    const result: Group[] = [];
    let lastDate = '';
    messages.forEach((msg, i) => {
      const d = new Date(msg.createdAt);
      const dateLabel = isTodayIST(d) ? 'Today'
                      : isYesterdayIST(d) ? 'Yesterday'
                      : new Intl.DateTimeFormat('en-IN', {
                          day: 'numeric', month: 'long', year: 'numeric', timeZone: IST,
                        }).format(d);
      const showDate = dateLabel !== lastDate;
      if (showDate) lastDate = dateLabel;
      const prev    = messages[i - 1];
      const isFirst = !prev || !isSameAuthorWithin5Min(prev, msg) || showDate;
      result.push({ dateLabel: showDate ? dateLabel : null, msg: dmToChatMsg(msg), isFirst });
    });
    return result;
  }, [messages]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  // ✅ FIXED: accept media from MessageInput and pass it through to onSend
  const handleSend = useCallback((content: string, media?: UploadedMedia) => {
    onSend(content, media, replyingTo?.id);
    setReplyingTo(null);
  }, [onSend, replyingTo]);

  // Delete — optimistic, then REST; partner sees via dm:message:deleted socket
  const doDelete = useCallback(async (id: string) => {
    if (!token) return;
    useDMStore.getState().applyDelete(id);
    try {
      await fetch(`/api/dm/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* optimistic already applied */ }
  }, [token]);

  const handleDelete = useCallback((id: string) => {
    if (localStorage.getItem(SKIP_KEY) === 'true') { doDelete(id); return; }
    const msg = useDMStore.getState().messages.find(m => m.id === id);
    if (msg) setDeleteTarget(msg);
  }, [doDelete]);

  const handleModalConfirm = useCallback((dontAskAgain: boolean) => {
    if (!deleteTarget) return;
    if (dontAskAgain) localStorage.setItem(SKIP_KEY, 'true');
    doDelete(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, doDelete]);

  // Edit — optimistic + socket broadcast via onEdit
  const handleStartEdit  = useCallback((id: string) => setEditingId(id), []);
  const handleCancelEdit = useCallback(() => setEditingId(null), []);
  const handleSaveEdit   = useCallback((id: string, content: string) => {
    setEditingId(null);
    useDMStore.getState().applyEdit(id, content, new Date().toISOString());
    onEdit(id, content);
  }, [onEdit]);

  // React — optimistic + REST; server returns authoritative reaction list
  const handleReact = useCallback(async (msgId: string, emoji: string) => {
    if (!token) return;
    const store = useDMStore.getState();
    const current = store.messages.find(m => m.id === msgId);
    if (current) {
      const userId  = user?.id ?? '';
      const already = current.reactions.some(r => r.emoji === emoji && r.userId === userId);
      store.applyReaction(msgId,
        already
          ? current.reactions.filter(r => !(r.emoji === emoji && r.userId === userId))
          : [...current.reactions, { emoji, userId }],
      );
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

  // Reply
  const handleReply = useCallback((msg: DMMessage) => setReplyingTo(msg), []);

  // Reaction picker
  const handleOpenReactionPicker  = useCallback((id: string) => setReactingMsgId(id), []);
  const handleCloseReactionPicker = useCallback(() => setReactingMsgId(null), []);

  // Pin — optimistic + REST; partner sees via dm:message:pinned socket
  const handlePin = useCallback(async (msg: { id: string; pinned: boolean }) => {
    if (!token) return;
    const newPinned = !msg.pinned;
    useDMStore.getState().applyPinToggle(msg.id, newPinned);
    try {
      const res = await fetch(`/api/dm/messages/${msg.id}/pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('pin failed');
    } catch {
      useDMStore.getState().applyPinToggle(msg.id, msg.pinned); // rollback
    }
  }, [token]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Message list — full height, partner info is already in the header */}
        <div ref={scrollRef} className="messages-container scrollbar-thin" onScroll={handleScroll}>
          {/* Inner wrapper observed by ResizeObserver for image-load / reaction height changes */}
          <div ref={contentRef}>
          {isLoading ? <SkMessageList /> : (
            <>
              {isLoadingOlder && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {/* Compact beginning-of-history label — scrolls with messages, only visible at the top */}
              {!hasMore && (
                <div className="flex items-center gap-3 px-4 pt-8 pb-5 select-none">
                  <LazyAvatar name={partner?.displayName ?? '?'} avatarUrl={partner?.avatarUrl} size={10} />
                  <div>
                    <p className="text-sm font-semibold text-text-normal">{partner?.displayName}</p>
                    <p className="text-xs text-text-muted">This is the very beginning of your conversation with <strong>@{partner?.username}</strong>.</p>
                  </div>
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
                    onReply={() => {
                      const raw = useDMStore.getState().messages.find(m => m.id === msg.id);
                      if (raw) handleReply(raw);
                    }}
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
        </div>

        {/* Typing indicator */}
        <div className="typing-indicator">
          {typingUsers.length > 0 && (
            <>
              <div className="typing-dots">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
              <span>
                {typingUsers.length === 1
                  ? <><strong>{typingUsers[0]}</strong> is typing…</>
                  : typingUsers.length === 2
                  ? <><strong>{typingUsers[0]}</strong> and <strong>{typingUsers[1]}</strong> are typing…</>
                  : <><strong>Several people</strong> are typing…</>}
              </span>
            </>
          )}
        </div>

        {/* Reply banner */}
        {replyingTo && (
          <div className="reply-banner">
            <Reply className="w-4 h-4 text-brand flex-shrink-0" />
            <span className="reply-banner-text">
              Replying to <strong className="text-text-normal">{replyingTo.user.displayName}</strong>
              <span className="ml-2 text-text-muted truncate max-w-xs inline-block align-bottom">
                {replyingTo.content}
              </span>
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
          isDM
          onTyping={onTyping}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>

      {/* Pinned messages panel */}
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
                    className="p-4 hover:bg-bg-hover cursor-pointer transition-colors"
                    onClick={() => {
                      document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      onClosePinned?.();
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-text-normal">{m.user.displayName}</span>
                      <span className="text-xs text-text-muted">
                        {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted line-clamp-2">
                      {m.content || (m.mediaType === 'image' ? '📷 Image' : m.mediaType === 'video' ? '🎬 Video' : '(empty)')}
                    </p>
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
