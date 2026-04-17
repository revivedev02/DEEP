import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  Bell, Pin, Search, Moon, Sun, Monitor, Users, X,
} from 'lucide-react';
import { LazyAvatar } from '@/components/LazyAvatar';
import { MessageInput } from '@/components/MessageInput';
import { MessageItem } from '@/components/MessageItem';
import { SearchBar } from '@/components/SearchBar';
import { useDMStore, type DMMessage } from '@/store/useDMStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { isTodayIST, isYesterdayIST, isSameAuthorWithin5Min, IST, scrollToMessage } from './messageUtils';

// ── DMMessage → ChatMessage adapter (MessageItem expects ChatMessage shape) ───
function dmToChatMsg(m: DMMessage) {
  return {
    ...m,
    channelId: m.conversationId,
    pinned: false,
    reactions: [],
    replyToId: null,
    replyTo: null,
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

// ── Partner info side panel ───────────────────────────────────────────────────
function PartnerInfoPanel({ partner }: { partner: DMPaneProps['partner'] }) {
  if (!partner) return null;
  return (
    <div className="w-60 flex-shrink-0 border-l border-separator bg-bg-secondary flex flex-col animate-fade-in">
      <div className="px-4 pt-6 pb-4 flex flex-col items-center text-center border-b border-separator">
        <LazyAvatar name={partner.displayName} avatarUrl={partner.avatarUrl} size={20} />
        <h3 className="font-bold text-text-normal mt-3 text-lg">{partner.displayName}</h3>
        <p className="text-sm text-text-muted">@{partner.username}</p>
        {partner.isAdmin && (
          <span className="mt-1 text-2xs bg-brand/20 text-brand px-2 py-0.5 rounded-full font-medium">ADMIN</span>
        )}
      </div>
      <div className="px-4 py-4">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">About</p>
        <p className="text-sm text-text-muted">Member of this server.</p>
      </div>
    </div>
  );
}

interface DMPaneProps {
  conversationId: string;
  partner: { id: string; displayName: string; username: string; avatarUrl?: string | null; isAdmin: boolean } | null;
  onClose: () => void;
  onSend: (content: string) => void;
  onTyping: (typing: boolean) => void;
  onLoadOlder: () => void;
}

export default function DMPane({ conversationId, partner, onClose, onSend, onTyping, onLoadOlder }: DMPaneProps) {
  const { messages, isLoading, isLoadingOlder, hasMore, typingUsers } = useDMStore();
  const { user } = useAuthStore();
  const { theme, cycleTheme } = useThemeStore();

  // Header panel states
  const [showSearch,  setShowSearch]  = useState(false);
  const [showPartner, setShowPartner] = useState(false);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll to bottom on new message, preserve position on prepend
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevCount = prevCountRef.current;
    if (messages.length > prevCount) {
      if (messages.length - prevCount === 1) {
        el.scrollTop = el.scrollHeight;
      } else {
        const firstNewMsg = messages[messages.length - prevCount];
        if (firstNewMsg) {
          const msgEl = document.getElementById(`msg-${firstNewMsg.id}`);
          if (msgEl) requestAnimationFrame(() => msgEl.scrollIntoView({ block: 'start' }));
        }
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Infinite scroll trigger
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 100 && hasMore && !isLoadingOlder) onLoadOlder();
  }, [hasMore, isLoadingOlder, onLoadOlder]);

  // Group messages by date + consecutive author
  type Group = { dateLabel: string | null; msg: ReturnType<typeof dmToChatMsg>; isFirst: boolean };
  const groups = useMemo<Group[]>(() => {
    const result: Group[] = [];
    let lastDate = '';
    messages.forEach((msg, i) => {
      const d = new Date(msg.createdAt);
      const dateLabel = isTodayIST(d)     ? 'Today'
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

  const noop = useCallback(() => {}, []);

  // Shape messages for SearchBar
  const searchMessages = useMemo(() =>
    messages.map(m => dmToChatMsg(m) as any), [messages]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* ── DM Header ── */}
        <div className="channel-header">
          {/* Partner identity */}
          <LazyAvatar name={partner?.displayName ?? '?'} avatarUrl={partner?.avatarUrl} size={8} />
          <div className="flex flex-col ml-1">
            <span className="channel-header-name text-sm leading-tight">{partner?.displayName ?? 'Unknown'}</span>
            <span className="text-xs text-text-muted leading-tight">@{partner?.username}</span>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button className="input-action-btn" title="Notifications (coming soon)">
              <Bell className="w-5 h-5" />
            </button>

            <button className="input-action-btn" title="Pinned messages (coming soon)">
              <Pin className="w-5 h-5" />
            </button>

            <button
              onClick={() => { setShowSearch(s => !s); }}
              className={`input-action-btn ${showSearch ? 'text-brand' : ''}`}
              title="Search messages"
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              onClick={cycleTheme}
              className="input-action-btn"
              title={`Theme: ${theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'OLED'} — click to switch`}
            >
              {theme === 'dark'  ? <Moon className="w-5 h-5" />
               : theme === 'light' ? <Sun className="w-5 h-5" />
               : <Monitor className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setShowPartner(p => !p)}
              className={`input-action-btn ${showPartner ? 'text-text-normal' : ''}`}
              title="Partner info"
            >
              <Users className="w-5 h-5" />
            </button>

            <div className="w-px h-5 bg-separator mx-1" />

            <button onClick={onClose} className="input-action-btn" title="Close DM">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <SearchBar
            messages={searchMessages}
            currentUserId={user?.id ?? ''}
            onClose={() => setShowSearch(false)}
            onJump={scrollToMessage}
          />
        )}

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
        <div
          ref={scrollRef}
          className="messages-container scrollbar-thin"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
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
                    onDelete={noop as any}
                    onReply={noop as any}
                    onPin={noop as any}
                    editingId={null}
                    onStartEdit={noop as any}
                    onSaveEdit={noop as any}
                    onCancelEdit={noop}
                    onReact={noop as any}
                    reactingMsgId={null}
                    onOpenReactionPicker={noop as any}
                    onCloseReactionPicker={noop}
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

        {/* Input */}
        <MessageInput
          onSend={onSend}
          channelName={partner?.displayName ?? 'user'}
          onTyping={onTyping}
          onCancelReply={noop}
        />
      </div>

      {/* Partner info panel (slides in from right, like members panel) */}
      {showPartner && <PartnerInfoPanel partner={partner} />}
    </div>
  );
}
