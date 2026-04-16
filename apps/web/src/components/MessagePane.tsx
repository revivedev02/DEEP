import { format, isToday, isYesterday } from 'date-fns';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Hash, Smile, PlusCircle, Gift, Sticker, Send, Users, Bell, Pin, Search, Copy, Trash2, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { useScrollToBottom } from '@/hooks/useScrollToBottom';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore } from '@/store/useServerStore';
import { SkMessageList } from '@/components/Skeleton';
import { useThemeStore } from '@/store/useThemeStore';

// ─── helpers ────────────────────────────────────────────────────────────────
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isToday(d))     return `Today at ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
  return format(d, 'MM/dd/yyyy h:mm a');
}

function shortTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

function isSameAuthorWithin5Min(a: ChatMessage, b: ChatMessage): boolean {
  if (a.userId !== b.userId) return false;
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60 * 1000;
}

// ─── Avatar ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-brand', 'bg-purple-600', 'bg-green-600',
  'bg-orange-500', 'bg-pink-600', 'bg-cyan-600', 'bg-yellow-600',
];

function AvatarPlaceholder({ name, size = 10 }: { name: string; size?: number }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div
      className={`w-${size} h-${size} rounded-full ${color} flex items-center justify-center
                  text-white font-semibold flex-shrink-0 cursor-pointer select-none
                  hover:brightness-110 transition-all`}
      style={{ fontSize: size === 10 ? 16 : 13 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

// ─── Date divider ────────────────────────────────────────────────────────────
function DateDivider({ label }: { label: string }) {
  const line = {
    flex: 1,
    height: '1px',
    background: 'rgb(var(--separator-rgb) / 0.5)',
  } as React.CSSProperties;
  return (
    <div className="flex items-center gap-3 px-4 my-5 select-none">
      <div style={line} />
      <span className="text-xs font-medium text-text-muted whitespace-nowrap tracking-wide">
        {label}
      </span>
      <div style={line} />
    </div>
  );
}

// ─── Single message ──────────────────────────────────────────────────────────
function Message({
  msg, isFirst, currentUserId, isAdmin: currentUserIsAdmin, onDelete,
}: {
  msg: ChatMessage; isFirst: boolean; currentUserId: string; isAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  const isMe = msg.userId === currentUserId;
  const canDelete = isMe || currentUserIsAdmin;

  const ActionBar = () => (
    <div className="message-actions">
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
      <div className="message-group with-avatar group">
        <AvatarPlaceholder name={msg.user.displayName} />
        <div className="message-body">
          <div className="message-header">
            <span className={`message-author ${msg.user.isAdmin ? 'admin' : ''}`}>
              {msg.user.displayName}
              {msg.user.isAdmin && <span className="ml-1.5 text-2xs bg-brand/20 text-brand px-1.5 py-0.5 rounded font-medium">ADMIN</span>}
              {isMe && <span className="ml-1.5 text-2xs bg-bg-modifier text-text-muted px-1.5 py-0.5 rounded font-medium">YOU</span>}
            </span>
            <span className="message-timestamp">{formatTimestamp(msg.createdAt)}</span>
          </div>
          <p className="message-content">{msg.content}</p>
        </div>
        <ActionBar />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 px-4 py-0.5 hover:bg-bg-modifier transition-colors duration-75 rounded group message-group">
      <div className="w-10 flex-shrink-0 flex justify-center pt-1">
        <span className="hidden group-hover:inline text-2xs text-text-muted leading-5">{shortTime(msg.createdAt)}</span>
      </div>
      <p className="message-content flex-1">{msg.content}</p>
      <ActionBar />
    </div>
  );
}

// ─── Welcome / empty state ───────────────────────────────────────────────────
function WelcomeBanner({ channelName }: { channelName: string }) {
  return (
    <div className="px-4 mb-6 pt-8">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-brand/20 mb-4">
        <Hash className="w-8 h-8 text-brand" />
      </div>
      <h2 className="text-2xl font-bold text-text-normal mb-1">Welcome to #{channelName}!</h2>
      <p className="text-text-muted text-sm max-w-md">
        This is the very beginning of <span className="text-text-normal font-medium">#{channelName}</span>.
        Send a message to get the conversation started. Only your crew can see this.
      </p>
    </div>
  );
}

// ─── Message input ───────────────────────────────────────────────────────────
interface InputProps {
  onSend: (content: string) => void;
  channelName: string;
  onTyping: (v: boolean) => void;
}

function MessageInput({ onSend, channelName, onTyping }: InputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    onTyping(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    // Typing indicator
    onTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 3000);
  };

  return (
    <div className="message-input-wrapper">
      <div className="message-input-box">
        <button className="input-action-btn" title="Attach (coming soon)">
          <PlusCircle className="w-5 h-5" />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          className="message-input"
          rows={1}
        />
        <div className="flex items-center gap-1">
          <button className="input-action-btn" title="Gift (coming soon)">
            <Gift className="w-4 h-4" />
          </button>
          <button className="input-action-btn" title="Sticker (coming soon)">
            <Sticker className="w-4 h-4" />
          </button>
          <button className="input-action-btn" title="Emoji (coming soon)">
            <Smile className="w-4 h-4" />
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className={`input-action-btn transition-colors ${value.trim() ? 'text-brand hover:text-brand-hover' : ''}`}
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
interface Props {
  onSendMessage: (content: string) => void;
  onTyping: (v: boolean) => void;
}

export default function MessagePane({ onSendMessage, onTyping }: Props) {
  const { messages, isConnected, isLoadingMessages, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const { toggleMembers, showMembers, activeChannel } = useUIStore();
  const { channels } = useServerStore();
  const { theme, toggleTheme } = useThemeStore();
  const scrollRef = useScrollToBottom<HTMLDivElement>([messages.length]);
  const { token } = useAuthStore();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const channelName = activeChannelObj?.name ?? 'general';

  const handleDeleteMessage = useCallback(async (id: string) => {
    if (!confirm('Delete this message?')) return;
    await fetch(`/api/messages/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    // Optimistic removal from store
    useChatStore.getState().setMessages(
      useChatStore.getState().messages.filter(m => m.id !== id)
    );
  }, [token]);

  // Group messages by date + consecutive author
  type Group = { dateLabel: string | null; msg: ChatMessage; isFirst: boolean };
  const groups = useMemo<Group[]>(() => {
    const result: Group[] = [];
    let lastDate = '';
    messages.forEach((msg, i) => {
      const d = new Date(msg.createdAt);
      let dateLabel = isToday(d)
        ? 'Today'
        : isYesterday(d)
        ? 'Yesterday'
        : format(d, 'MMMM d, yyyy');
      const showDate = dateLabel !== lastDate;
      if (showDate) lastDate = dateLabel;

      const prev = messages[i - 1];
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
        <div className="channel-header-topic">
          <span>General chat for the crew</span>
        </div>
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
        {isLoadingMessages ? (
          <SkMessageList />
        ) : (
          <>
            <WelcomeBanner channelName={channelName} />
            {groups.map(({ dateLabel, msg, isFirst }) => (
              <div key={msg.id}>
                {dateLabel && <DateDivider label={dateLabel} />}
                <Message msg={msg} isFirst={isFirst} currentUserId={user?.id ?? ''}
                  isAdmin={user?.isAdmin ?? false} onDelete={handleDeleteMessage} />
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
              {typingUsers.length === 1
                ? <><strong>{typingUsers[0]}</strong> is typing…</>
                : typingUsers.length === 2
                ? <><strong>{typingUsers[0]}</strong> and <strong>{typingUsers[1]}</strong> are typing…</>
                : <><strong>Several people</strong> are typing…</>}
            </span>
          </>
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={onSendMessage} channelName={channelName} onTyping={onTyping} />
    </div>
  );
}
