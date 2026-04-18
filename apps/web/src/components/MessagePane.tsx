import { useState, useCallback } from 'react';
import { Reply, X, WifiOff } from 'lucide-react';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import PinnedPanel from '@/components/PinnedPanel';
import { MessageInput } from '@/components/MessageInput';
import { MessageList } from '@/components/MessageList';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore } from '@/store/useServerStore';
import type { UploadedMedia } from '@/lib/uploadMedia';

interface Props {
  onSendMessage:    (content: string, media?: UploadedMedia) => void;
  onTyping:         (v: boolean) => void;
  onLoadOlder:      () => void;
  showPinnedPanel:  boolean;
  onClosePinned:    () => void;
}

export default function MessagePane({ onSendMessage, onTyping, onLoadOlder, showPinnedPanel, onClosePinned }: Props) {
  const { messages, typingUsers, replyingTo, setReplyingTo } = useChatStore();
  const { user } = useAuthStore();
  const { activeChannel } = useUIStore();
  const { channels } = useServerStore();
  const { token } = useAuthStore();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const channelName = activeChannelObj?.name ?? 'general';

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const SKIP_KEY = 'deep:deleteNoConfirm';

  const doDelete = useCallback(async (id: string) => {
    await fetch(`/api/messages/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    useChatStore.getState().setMessages(useChatStore.getState().messages.filter(m => m.id !== id));
  }, [token]);

  const handleDeleteMessage = useCallback((id: string) => {
    if (localStorage.getItem(SKIP_KEY) === 'true') { doDelete(id); return; }
    const msg = useChatStore.getState().messages.find(m => m.id === id);
    if (msg) setDeleteTarget(msg);
  }, [doDelete]);

  const handleModalConfirm = useCallback((dontAskAgain: boolean) => {
    if (!deleteTarget) return;
    if (dontAskAgain) localStorage.setItem(SKIP_KEY, 'true');
    doDelete(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, doDelete]);

  // ── Reply ──────────────────────────────────────────────────────────────────
  const handleReply = useCallback((msg: ChatMessage) => setReplyingTo(msg), [setReplyingTo]);

  // ── Pin ────────────────────────────────────────────────────────────────────
  const handlePin = useCallback(async (msg: ChatMessage) => {
    if (!token) return;
    const newPinned = !msg.pinned;
    useChatStore.getState().applyPinToggle(msg.id, newPinned);
    try {
      const res = await fetch(`/api/messages/${msg.id}/pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('pin failed');
      const channel = useUIStore.getState().activeChannel;
      if (channel) {
        const pinned = await fetch(`/api/messages/pinned?channelId=${encodeURIComponent(channel)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).catch(() => null);
        if (Array.isArray(pinned)) useChatStore.getState().setPinnedMessages(pinned);
      }
    } catch {
      useChatStore.getState().applyPinToggle(msg.id, !newPinned);
    }
  }, [token]);

  // ── Edit ───────────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const handleStartEdit  = useCallback((id: string) => setEditingId(id), []);
  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  const handleSaveEdit = useCallback(async (id: string, content: string) => {
    if (!token) return;
    setEditingId(null);
    useChatStore.getState().applyEdit(id, content, new Date().toISOString());
    try {
      await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    } catch { /* keep optimistic */ }
  }, [token]);

  // ── Reactions ──────────────────────────────────────────────────────────────
  const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);
  const handleOpenReactionPicker  = useCallback((id: string) => setReactingMsgId(id), []);
  const handleCloseReactionPicker = useCallback(() => setReactingMsgId(null), []);

  const handleReact = useCallback(async (msgId: string, emoji: string) => {
    if (!token) return;
    const current = useChatStore.getState().messages.find(m => m.id === msgId);
    if (current) {
      const userId = user?.id ?? '';
      const already = current.reactions?.some(r => r.emoji === emoji && r.userId === userId);
      const next = already
        ? (current.reactions ?? []).filter(r => !(r.emoji === emoji && r.userId === userId))
        : [...(current.reactions ?? []), { emoji, userId }];
      useChatStore.getState().applyReaction(msgId, next);
    }
    try {
      await fetch(`/api/messages/${msgId}/reactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    } catch { /* socket event will correct drift */ }
  }, [token, user?.id]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Message list */}
        <MessageList
          currentUserId={user?.id ?? ''}
          isAdmin={user?.isAdmin ?? false}
          channelName={channelName}
          onLoadOlder={onLoadOlder}
          onDelete={handleDeleteMessage}
          onReply={handleReply}
          onPin={handlePin}
          editingId={editingId}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onReact={handleReact}
          reactingMsgId={reactingMsgId}
          onOpenReactionPicker={handleOpenReactionPicker}
          onCloseReactionPicker={handleCloseReactionPicker}
        />

        {/* Typing indicator */}
        <div className="typing-indicator">
          {typingUsers.length > 0 && (
            <>
              <div className="typing-dots">
                <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
              </div>
              <span>
                {typingUsers.length === 1   ? <><strong>{typingUsers[0]}</strong> is typing…</>
                 : typingUsers.length === 2  ? <><strong>{typingUsers[0]}</strong> and <strong>{typingUsers[1]}</strong> are typing…</>
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
              <span className="ml-2 text-text-muted truncate max-w-xs inline-block align-bottom">{replyingTo.content}</span>
            </span>
            <button className="ml-auto p-1 rounded hover:bg-bg-modifier text-text-muted hover:text-text-normal transition-colors"
              onClick={() => setReplyingTo(null)} title="Cancel reply (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <MessageInput
          onSend={onSendMessage}
          channelName={channelName}
          onTyping={onTyping}
          onCancelReply={() => setReplyingTo(null)}
        />

        {deleteTarget && (
          <DeleteConfirmModal
            authorName={deleteTarget.user.displayName}
            preview={deleteTarget.content}
            onConfirm={handleModalConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>

      {/* Pinned Panel */}
      {showPinnedPanel && (
        <PinnedPanel channelName={channelName} onClose={onClosePinned} />
      )}
    </div>
  );
}
