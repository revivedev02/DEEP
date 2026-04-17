import { useState, useCallback } from 'react';
import {
  Hash, Users, Bell, Pin, Search, Moon, Sun, Reply, X, WifiOff, Monitor,
} from 'lucide-react';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import PinnedPanel from '@/components/PinnedPanel';
import { MessageInput } from '@/components/MessageInput';
import { MessageList } from '@/components/MessageList';
import { SearchBar } from '@/components/SearchBar';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore } from '@/store/useServerStore';
import { useThemeStore } from '@/store/useThemeStore';
import { scrollToMessage } from './messageUtils';

interface Props {
  onSendMessage: (content: string) => void;
  onTyping: (v: boolean) => void;
  onLoadOlder: () => void;
}

export default function MessagePane({ onSendMessage, onTyping, onLoadOlder }: Props) {
  const { messages, isConnected, typingUsers, replyingTo, setReplyingTo } = useChatStore();
  const { user } = useAuthStore();
  const { toggleMembers, showMembers, activeChannel } = useUIStore();
  const { channels } = useServerStore();
  const { theme, cycleTheme } = useThemeStore();
  const { token } = useAuthStore();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const channelName = activeChannelObj?.name ?? 'general';

  // Panel toggles
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);

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
    } catch { /* socket event will correct any drift */ }
  }, [token, user?.id]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Channel header */}
        <div className="channel-header">
          <Hash className="w-5 h-5 text-text-muted flex-shrink-0" />
          <span className="channel-header-name">{channelName}</span>
          <div className="channel-header-topic"><span>General chat for the crew</span></div>
          <div className="flex items-center gap-1 ml-auto">
            <div className="flex items-center gap-1 mr-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-status-green animate-pulse' : 'bg-text-muted'}`} />
              <span className="text-xs text-text-muted">{isConnected ? 'live' : 'offline'}</span>
            </div>
            <button className="input-action-btn" title="Notifications (coming soon)"><Bell className="w-5 h-5" /></button>
            <button
              onClick={() => { setShowPinned(p => !p); setShowSearch(false); }}
              className={`input-action-btn ${showPinned ? 'text-brand' : ''}`}
              title="Pinned messages"
            >
              <Pin className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setShowSearch(s => !s); setShowPinned(false); }}
              className={`input-action-btn ${showSearch ? 'text-brand' : ''}`}
              title="Search messages"
            >
              <Search className="w-5 h-5" />
            </button>
            <button onClick={cycleTheme} className="input-action-btn"
              title={`Theme: ${theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'OLED'} — click to switch`}>
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : theme === 'light' ? <Sun className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </button>
            <button onClick={toggleMembers} className={`input-action-btn ${showMembers ? 'text-text-normal' : ''}`} title="Toggle members">
              <Users className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <SearchBar
            messages={messages}
            currentUserId={user?.id ?? ''}
            onClose={() => setShowSearch(false)}
            onJump={scrollToMessage}
          />
        )}

        {/* Message list with infinite scroll */}
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
               : typingUsers.length === 2   ? <><strong>{typingUsers[0]}</strong> and <strong>{typingUsers[1]}</strong> are typing…</>
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
      {showPinned && (
        <PinnedPanel channelName={channelName} onClose={() => setShowPinned(false)} />
      )}
    </div>
  );
}
