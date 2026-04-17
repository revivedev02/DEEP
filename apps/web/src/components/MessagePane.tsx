import { useMemo, useState, useRef, useCallback } from 'react';
import { Hash, Smile, PlusCircle, Gift, Sticker, Send, Users, Bell, Pin, Search, Copy, Trash2, Moon, Sun, Reply, X, AtSign, WifiOff } from 'lucide-react';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { LazyAvatar } from '@/components/LazyAvatar';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { useMembersStore } from '@/store/useMembersStore';
import { useScrollToBottom } from '@/hooks/useScrollToBottom';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore } from '@/store/useServerStore';
import { SkMessageList } from '@/components/Skeleton';
import { useThemeStore } from '@/store/useThemeStore';

// ─── IST timestamp helpers ────────────────────────────────────────────────────
const IST = 'Asia/Kolkata';
const timeFmt   = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
const fullFmt   = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
const dateParts = new Intl.DateTimeFormat('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: IST });

function istDateKey(d: Date): string {
  const p = dateParts.formatToParts(d);
  const y  = p.find(x => x.type === 'year')!.value;
  const m  = p.find(x => x.type === 'month')!.value;
  const dd = p.find(x => x.type === 'day')!.value;
  return `${y}-${m}-${dd}`;
}
function isTodayIST(d: Date)     { return istDateKey(d) === istDateKey(new Date()); }
function isYesterdayIST(d: Date) { return istDateKey(d) === istDateKey(new Date(Date.now() - 86400000)); }

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isTodayIST(d))     return `Today at ${timeFmt.format(d)}`;
  if (isYesterdayIST(d)) return `Yesterday at ${timeFmt.format(d)}`;
  return fullFmt.format(d);
}
function shortTime(iso: string): string { return timeFmt.format(new Date(iso)); }

function isSameAuthorWithin5Min(a: ChatMessage, b: ChatMessage): boolean {
  if (a.userId !== b.userId) return false;
  if (b.replyToId) return false;
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60 * 1000;
}

// ─── Scroll to + flash highlight a message by ID ─────────────────────────────
function scrollToMessage(id: string) {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('message-flash');
  setTimeout(() => el.classList.remove('message-flash'), 1800);
}

// ─── Mention renderer ─────────────────────────────────────────────────────────
function MentionText({ content, currentUserId }: { content: string; currentUserId: string }) {
  // Use hook (not getState) so mentions reactively update when members load
  const { members } = useMembersStore();
  const parts = content.split(/(@everyone|@[\w.]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part === '@everyone') return <span key={i} className="mention mention-everyone">@everyone</span>;
        if (part.startsWith('@')) {
          const handle = part.slice(1).toLowerCase();
          const member = members.find(m =>
            m.username.toLowerCase() === handle || m.displayName.toLowerCase() === handle
          );
          if (member) {
            return (
              <span key={i} className={`mention ${member.id === currentUserId ? 'mention-me' : 'mention-other'}`}>
                {part}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Date divider ─────────────────────────────────────────────────────────────
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

// ─── Reply preview — Discord style ───────────────────────────────────────────
function ReplyPreview({ replyTo }: { replyTo: NonNullable<ChatMessage['replyTo']> }) {
  return (
    <div className="reply-wrapper" onClick={() => scrollToMessage(replyTo.id)} title="Jump to original message">
      <div className="reply-connector" />
      <LazyAvatar name={replyTo.user.displayName} avatarUrl={replyTo.user.avatarUrl} size={4} className="flex-shrink-0" />
      <span className="reply-author">@{replyTo.user.displayName}</span>
      <span className="reply-text">{replyTo.content}</span>
    </div>
  );
}

// ─── Single message ───────────────────────────────────────────────────────────
function Message({
  msg, isFirst, currentUserId, isAdmin: currentUserIsAdmin, onDelete, onReply,
}: {
  msg: ChatMessage; isFirst: boolean; currentUserId: string; isAdmin: boolean;
  onDelete: (id: string) => void;
  onReply:  (msg: ChatMessage) => void;
}) {
  const isMe      = msg.userId === currentUserId;
  const canDelete = isMe || currentUserIsAdmin;

  const ActionBar = () => (
    <div className="message-actions">
      <button className="message-action-btn" title="Reply" onClick={() => onReply(msg)}>
        <Reply className="w-3.5 h-3.5" />
      </button>
      <button className="message-action-btn" title="Copy" onClick={() => navigator.clipboard.writeText(msg.content)}>
        <Copy className="w-3.5 h-3.5" />
      </button>
      {canDelete && (
        <button className="message-action-btn hover:!text-status-red" title="Delete" onClick={() => onDelete(msg.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  if (isFirst) {
    return (
      <div id={`msg-${msg.id}`} className="message-group with-avatar group">
        {msg.replyTo && <ReplyPreview replyTo={msg.replyTo} />}
        <div className="flex items-start gap-4">
          <LazyAvatar name={msg.user.displayName} avatarUrl={msg.user.avatarUrl} size={10} />
          <div className="message-body">
            <div className="message-header">
              <span className={`message-author ${msg.user.isAdmin ? 'admin' : ''}`}>
                {msg.user.displayName}
                {msg.user.isAdmin && <span className="ml-1.5 text-2xs bg-brand/20 text-brand px-1.5 py-0.5 rounded font-medium">ADMIN</span>}
                {isMe && <span className="ml-1.5 text-2xs bg-bg-modifier text-text-muted px-1.5 py-0.5 rounded font-medium">YOU</span>}
              </span>
              <span className="message-timestamp">{formatTimestamp(msg.createdAt)}</span>
            </div>
            <p className="message-content">
              <MentionText content={msg.content} currentUserId={currentUserId} />
            </p>
          </div>
        </div>
        <ActionBar />
      </div>
    );
  }

  return (
    <div id={`msg-${msg.id}`} className="flex items-start gap-4 px-4 py-0.5 hover:bg-bg-modifier transition-colors duration-75 rounded group message-group">
      <div className="w-10 flex-shrink-0 flex justify-center pt-1">
        <span className="hidden group-hover:inline text-2xs text-text-muted leading-5">{shortTime(msg.createdAt)}</span>
      </div>
      <p className="message-content flex-1">
        <MentionText content={msg.content} currentUserId={currentUserId} />
      </p>
      <ActionBar />
    </div>
  );
}

// ─── Welcome banner ───────────────────────────────────────────────────────────
function WelcomeBanner({ channelName }: { channelName: string }) {
  return (
    <div className="px-4 mb-6 pt-8">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-brand/20 mb-4">
        <Hash className="w-8 h-8 text-brand" />
      </div>
      <h2 className="text-2xl font-bold text-text-normal mb-1">Welcome to #{channelName}!</h2>
      <p className="text-text-muted text-sm max-w-md">
        This is the very beginning of <span className="text-text-normal font-medium">#{channelName}</span>.
        Send a message to get the conversation started.
      </p>
    </div>
  );
}

// ─── Message input with @mention autocomplete ─────────────────────────────────
interface InputProps {
  onSend: (content: string) => void;
  channelName: string;
  onTyping: (v: boolean) => void;
  onCancelReply: () => void;
}

function MessageInput({ onSend, channelName, onTyping, onCancelReply }: InputProps) {
  const [value, setValue]               = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIdx, setActiveIdx]       = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const { members } = useMembersStore();

  // Build suggestions: @everyone first, then matching members
  const suggestions = mentionQuery !== null
    ? [
        ...('everyone'.startsWith(mentionQuery.toLowerCase())
          ? [{ id: '_everyone', displayName: 'everyone', username: 'everyone', avatarUrl: null as string | null }]
          : []),
        ...members.filter(m =>
          m.username.toLowerCase().startsWith(mentionQuery.toLowerCase()) ||
          m.displayName.toLowerCase().startsWith(mentionQuery.toLowerCase())
        ),
      ].slice(0, 8)
    : [];

  const insertMention = (name: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = value.slice(0, cursor);
    const atPos  = before.lastIndexOf('@');
    const after  = value.slice(cursor);
    const newVal = before.slice(0, atPos) + `@${name} ` + after;
    setValue(newVal);
    setMentionQuery(null);
    setActiveIdx(0);
    setTimeout(() => {
      ta.focus();
      const pos = atPos + name.length + 2;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && suggestions.length > 0) {
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % suggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[activeIdx]?.username ?? suggestions[activeIdx]?.displayName);
        return;
      }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { onCancelReply(); }
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    setMentionQuery(null);
    onTyping(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    // Detect @mention query from text before cursor
    const cursor = e.target.selectionStart;
    const before = v.slice(0, cursor);
    const match  = before.match(/@([\w.]*)$/);
    if (match) { setMentionQuery(match[1]); setActiveIdx(0); }
    else        { setMentionQuery(null); }
    // Typing indicator
    onTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 3000);
  };

  return (
    <div className="message-input-wrapper relative">
      {/* @ autocomplete popup */}
      {mentionQuery !== null && suggestions.length > 0 && (
        <div className="mention-dropdown">
          <div className="px-3 py-1.5 text-2xs text-text-muted font-semibold uppercase tracking-wider border-b border-separator/30">
            Members — type to filter
          </div>
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              className={`mention-item ${i === activeIdx ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); insertMention(s.username || s.displayName); }}
            >
              {s.id === '_everyone'
                ? <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0"><AtSign className="w-3 h-3 text-amber-400" /></span>
                : <LazyAvatar name={s.displayName} avatarUrl={s.avatarUrl} size={6} />}
              <span className="font-medium">{s.id === '_everyone' ? '@everyone' : s.displayName}</span>
              {s.id !== '_everyone' && <span className="text-text-muted text-xs">@{s.username}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="message-input-box">
        <button className="input-action-btn" title="Attach (coming soon)"><PlusCircle className="w-5 h-5" /></button>
        <textarea
          ref={textareaRef} value={value} onChange={handleInput} onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`} className="message-input" rows={1}
        />
        <div className="flex items-center gap-1">
          <button className="input-action-btn" title="Gift (coming soon)"><Gift className="w-4 h-4" /></button>
          <button className="input-action-btn" title="Sticker (coming soon)"><Sticker className="w-4 h-4" /></button>
          <button className="input-action-btn" title="Emoji (coming soon)"><Smile className="w-4 h-4" /></button>
          <button onClick={submit} disabled={!value.trim()}
            className={`input-action-btn transition-colors ${value.trim() ? 'text-brand hover:text-brand-hover' : ''}`} title="Send">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface Props {
  onSendMessage: (content: string) => void;
  onTyping: (v: boolean) => void;
}

export default function MessagePane({ onSendMessage, onTyping }: Props) {
  const { messages, isConnected, isLoadingMessages, loadError, typingUsers, replyingTo, setReplyingTo } = useChatStore();
  const { user } = useAuthStore();
  const { toggleMembers, showMembers, activeChannel } = useUIStore();
  const { channels } = useServerStore();
  const { theme, toggleTheme } = useThemeStore();
  const scrollRef = useScrollToBottom<HTMLDivElement>([messages.length]);
  const { token } = useAuthStore();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const channelName = activeChannelObj?.name ?? 'general';

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

  const handleReply = useCallback((msg: ChatMessage) => setReplyingTo(msg), [setReplyingTo]);

  // Group messages by date + consecutive author
  type Group = { dateLabel: string | null; msg: ChatMessage; isFirst: boolean };
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
      result.push({ dateLabel: showDate ? dateLabel : null, msg, isFirst });
    });
    return result;
  }, [messages]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
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
          <button className="input-action-btn" title="Pins (coming soon)"><Pin className="w-5 h-5" /></button>
          <button className="input-action-btn" title="Search (coming soon)"><Search className="w-5 h-5" /></button>
          <button onClick={toggleTheme} className="input-action-btn" title={`Switch to ${theme === 'light' ? 'OLED' : 'Light'} theme`}>
            {theme === 'oled' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={toggleMembers} className={`input-action-btn ${showMembers ? 'text-text-normal' : ''}`} title="Toggle members">
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="messages-container scrollbar-thin">
        {isLoadingMessages ? <SkMessageList /> : loadError ? (
          <div className="flex flex-col items-center justify-center flex-1 h-full gap-4 select-none">
            <div className="w-16 h-16 rounded-full bg-bg-modifier flex items-center justify-center">
              <WifiOff className="w-7 h-7 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-text-normal font-medium mb-1">{loadError}</p>
              <p className="text-text-muted text-sm">Check your connection and try again.</p>
            </div>
            <button
              onClick={() => useChatStore.getState().retryMessages()}
              className="btn btn-ghost btn-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <WelcomeBanner channelName={channelName} />
            {groups.map(({ dateLabel, msg, isFirst }) => (
              <div key={msg.id}>
                {dateLabel && <DateDivider label={dateLabel} />}
                <Message msg={msg} isFirst={isFirst} currentUserId={user?.id ?? ''}
                  isAdmin={user?.isAdmin ?? false} onDelete={handleDeleteMessage} onReply={handleReply} />
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

      <MessageInput onSend={onSendMessage} channelName={channelName} onTyping={onTyping} onCancelReply={() => setReplyingTo(null)} />

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
