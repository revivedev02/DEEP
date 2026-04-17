import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  Hash, Smile, PlusCircle, Gift, Sticker, Send, Users, Bell,
  Pin, Search, Copy, Trash2, Moon, Sun, Reply, X, AtSign, WifiOff, Pencil, SmilePlus, Monitor,
} from 'lucide-react';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import PinnedPanel from '@/components/PinnedPanel';
import { LazyAvatar } from '@/components/LazyAvatar';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage, type RawReaction } from '@/store/useChatStore';
import { useMembersStore } from '@/store/useMembersStore';
import { useScrollToBottom } from '@/hooks/useScrollToBottom';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore } from '@/store/useServerStore';
import { SkMessageList } from '@/components/Skeleton';
import { useThemeStore } from '@/store/useThemeStore';
// @ts-ignore — emoji-mart has no bundled types for the React wrapper
import EmojiPicker from '@emoji-mart/react';
import emojiData from '@emoji-mart/data';

// ─── IST timestamp helpers ────────────────────────────────────────────────────
const IST = 'Asia/Kolkata';
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
const fullFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
const dateParts = new Intl.DateTimeFormat('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: IST });

function istDateKey(d: Date) {
  const p = dateParts.formatToParts(d);
  return `${p.find(x => x.type === 'year')!.value}-${p.find(x => x.type === 'month')!.value}-${p.find(x => x.type === 'day')!.value}`;
}
function isTodayIST(d: Date)     { return istDateKey(d) === istDateKey(new Date()); }
function isYesterdayIST(d: Date) { return istDateKey(d) === istDateKey(new Date(Date.now() - 86400000)); }

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  if (isTodayIST(d))     return `Today at ${timeFmt.format(d)}`;
  if (isYesterdayIST(d)) return `Yesterday at ${timeFmt.format(d)}`;
  return fullFmt.format(d);
}
function shortTime(iso: string) { return timeFmt.format(new Date(iso)); }

function isSameAuthorWithin5Min(a: ChatMessage, b: ChatMessage) {
  if (a.userId !== b.userId) return false;
  if (b.replyToId) return false;
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60 * 1000;
}

// ─── Scroll to + flash highlight ─────────────────────────────────────────────
function scrollToMessage(id: string) {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('message-flash');
  setTimeout(() => el.classList.remove('message-flash'), 1800);
}

// ─── URL regex ────────────────────────────────────────────────────────────────
const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g;

// ─── Unified message content renderer: URLs + @mentions ──────────────────────
function MessageContent({ content, currentUserId }: { content: string; currentUserId: string }) {
  const { members } = useMembersStore();

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Reset regex state
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_RE.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before) parts.push(...renderMentions(before, members, currentUserId, parts.length));
    parts.push(
      <a key={`url-${match.index}`} href={match[0]} target="_blank" rel="noopener noreferrer" className="msg-link">
        {match[0]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex);
  if (remaining) parts.push(...renderMentions(remaining, members, currentUserId, parts.length + 1000));

  return <>{parts}</>;
}

function renderMentions(
  text: string,
  members: ReturnType<typeof useMembersStore.getState>['members'],
  currentUserId: string,
  keyOffset: number
): React.ReactNode[] {
  const chunks = text.split(/(@everyone|@[\w.]+)/g);
  return chunks.map((chunk, i) => {
    const key = keyOffset + i;
    if (chunk === '@everyone') return <span key={key} className="mention mention-everyone">@everyone</span>;
    if (chunk.startsWith('@')) {
      const handle = chunk.slice(1).toLowerCase();
      const member = members.find(m =>
        m.username.toLowerCase() === handle || m.displayName.toLowerCase() === handle
      );
      if (member) {
        return (
          <span key={key} className={`mention ${member.id === currentUserId ? 'mention-me' : 'mention-other'}`}>
            {chunk}
          </span>
        );
      }
    }
    return <span key={key}>{chunk}</span>;
  });
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

// ─── Reply preview ────────────────────────────────────────────────────────────
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

// ─── Reaction helpers ─────────────────────────────────────────────────────────
function groupReactions(reactions: RawReaction[], currentUserId: string) {
  const map = new Map<string, { count: number; hasMe: boolean }>();
  for (const r of reactions) {
    const cur = map.get(r.emoji) ?? { count: 0, hasMe: false };
    map.set(r.emoji, { count: cur.count + 1, hasMe: cur.hasMe || r.userId === currentUserId });
  }
  return Array.from(map.entries()).map(([emoji, { count, hasMe }]) => ({ emoji, count, hasMe }));
}

// ─── Reaction bar ─────────────────────────────────────────────────────────────
function ReactionBar({ reactions = [], currentUserId, onReact, onOpenPicker }: {
  reactions?: RawReaction[];
  currentUserId: string;
  onReact: (emoji: string) => void;
  onOpenPicker: () => void;
}) {
  const grouped = groupReactions(reactions, currentUserId);
  if (grouped.length === 0) return null;
  return (
    <div className="reaction-bar">
      {grouped.map(({ emoji, count, hasMe }) => (
        <button
          key={emoji}
          className={`reaction-pill ${hasMe ? 'reacted' : ''}`}
          title={hasMe ? 'Remove reaction' : 'Add reaction'}
          onClick={() => onReact(emoji)}
        >
          <span>{emoji}</span>
          <span className="reaction-count">{count}</span>
        </button>
      ))}
      <button className="reaction-add-btn" title="Add reaction" onClick={onOpenPicker}>
        <SmilePlus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Single message ───────────────────────────────────────────────────────────
function Message({
  msg, isFirst, currentUserId, isAdmin: currentUserIsAdmin,
  onDelete, onReply, onPin, onStartEdit, editingId, onSaveEdit, onCancelEdit,
  onReact, reactingMsgId, onOpenReactionPicker, onCloseReactionPicker,
}: {
  msg: ChatMessage; isFirst: boolean; currentUserId: string; isAdmin: boolean;
  onDelete: (id: string) => void;
  onReply:  (msg: ChatMessage) => void;
  onPin:    (msg: ChatMessage) => void;
  onStartEdit:  (id: string) => void;
  editingId:    string | null;
  onSaveEdit:   (id: string, content: string) => void;
  onCancelEdit: () => void;
  onReact:      (msgId: string, emoji: string) => void;
  reactingMsgId:         string | null;
  onOpenReactionPicker:  (msgId: string) => void;
  onCloseReactionPicker: () => void;
}) {
  const isMe           = msg.userId === currentUserId;
  const canDelete      = isMe || currentUserIsAdmin;
  const isEditing      = editingId === msg.id;
  const pickerOpen     = reactingMsgId === msg.id;

  // Quick-react emojis (no full picker)
  const QUICK_EMOJIS = ['😂', '😢', '😎', '💀', '❤️'];

  const [editValue, setEditValue] = useState(msg.content);
  const editRef    = useRef<HTMLTextAreaElement>(null);
  const pickerRef  = useRef<HTMLDivElement>(null);

  // Close quick picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) onCloseReactionPicker();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pickerOpen, onCloseReactionPicker]);

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = editValue.trim();
      if (t && t !== msg.content) onSaveEdit(msg.id, t); else onCancelEdit();
    }
    if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
  };

  const handleEditInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const EditBox = () => (
    <div className="mt-1 pr-4">
      <textarea
        ref={editRef} value={editValue} onChange={handleEditInput}
        onKeyDown={handleEditKeyDown} autoFocus
        className="message-edit-textarea w-full" rows={1}
      />
      <p className="message-edit-hint">
        <span className="text-brand cursor-pointer hover:underline"
          onClick={() => { const t = editValue.trim(); if (t && t !== msg.content) onSaveEdit(msg.id, t); else onCancelEdit(); }}>
          save
        </span>
        &nbsp;—&nbsp;
        <span className="cursor-pointer hover:underline" onClick={onCancelEdit}>esc to cancel</span>
      </p>
    </div>
  );

  const EditedLabel = () => msg.editedAt ? <span className="message-edited-label">(edited)</span> : null;

  // Action bar (inside message-group, hover-controlled via CSS)
  const ActionBar = () => (
    <div className="message-actions">
      <button
        className={`message-action-btn ${pickerOpen ? 'text-brand' : ''}`}
        title="React"
        onMouseDown={(e) => { e.stopPropagation(); pickerOpen ? onCloseReactionPicker() : onOpenReactionPicker(msg.id); }}
      >
        <SmilePlus className="w-3.5 h-3.5" />
      </button>
      <button className="message-action-btn" title="Reply" onClick={() => onReply(msg)}>
        <Reply className="w-3.5 h-3.5" />
      </button>
      {isMe && (
        <button className="message-action-btn" title="Edit"
          onClick={() => { setEditValue(msg.content); onStartEdit(msg.id); }}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {currentUserIsAdmin && (
        <button
          className={`message-action-btn ${msg.pinned ? 'text-brand' : ''}`}
          title={msg.pinned ? 'Unpin' : 'Pin'} onClick={() => onPin(msg)}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>
      )}
      <button className="message-action-btn" title="Copy"
        onClick={() => navigator.clipboard.writeText(msg.content)}>
        <Copy className="w-3.5 h-3.5" />
      </button>
      {canDelete && (
        <button className="message-action-btn hover:!text-status-red" title="Delete"
          onClick={() => onDelete(msg.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  // Quick-react popup — rendered OUTSIDE .message-actions so it doesn't disappear
  const QuickReactPopup = () => pickerOpen ? (
    <div ref={pickerRef}
      className="absolute right-3 -top-3 z-20 flex items-center gap-0.5 px-1.5 py-1 bg-bg-secondary border border-separator rounded-lg shadow-elevation-high"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {QUICK_EMOJIS.map(emoji => (
        <button
          key={emoji}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover transition-colors text-lg cursor-pointer"
          onClick={() => { onReact(msg.id, emoji); onCloseReactionPicker(); }}
        >
          {emoji}
        </button>
      ))}
    </div>
  ) : null;

  const reactionsBar = (
    <ReactionBar
      reactions={msg.reactions}
      currentUserId={currentUserId}
      onReact={(emoji) => onReact(msg.id, emoji)}
      onOpenPicker={() => onOpenReactionPicker(msg.id)}
    />
  );

  if (isFirst) {
    return (
      <div id={`msg-${msg.id}`} className={`message-group with-avatar group ${msg.pinned ? 'border-l-2 border-brand/40 pl-3' : ''}`}>
        {msg.replyTo && <ReplyPreview replyTo={msg.replyTo} />}
        <div className="flex items-start gap-4">
          <LazyAvatar name={msg.user.displayName} avatarUrl={msg.user.avatarUrl} size={10} />
          <div className="message-body flex-1 min-w-0">
            <div className="message-header">
              <span className={`message-author ${msg.user.isAdmin ? 'admin' : ''}`}>
                {msg.user.displayName}
                {msg.user.isAdmin && <span className="ml-1.5 text-2xs bg-brand/20 text-brand px-1.5 py-0.5 rounded font-medium">ADMIN</span>}
                {isMe && <span className="ml-1.5 text-2xs bg-bg-modifier text-text-muted px-1.5 py-0.5 rounded font-medium">YOU</span>}
              </span>
              <span className="message-timestamp">{formatTimestamp(msg.createdAt)}</span>
              {msg.pinned && <Pin className="w-3 h-3 text-brand ml-1 flex-shrink-0" title="Pinned" />}
            </div>
            {isEditing ? <EditBox /> : (
              <p className="message-content">
                <MessageContent content={msg.content} currentUserId={currentUserId} />
                <EditedLabel />
              </p>
            )}
            {reactionsBar}
          </div>
        </div>
        <ActionBar />
        <QuickReactPopup />
      </div>
    );
  }

  return (
    <div id={`msg-${msg.id}`} className={`flex items-start gap-4 px-4 py-0.5 hover:bg-bg-modifier transition-colors duration-75 rounded group message-group ${msg.pinned ? 'border-l-2 border-brand/40' : ''}`}>
      <div className="w-10 flex-shrink-0 flex justify-center pt-1">
        <span className="opacity-0 group-hover:opacity-100 text-2xs text-text-muted leading-5 transition-opacity duration-75">{shortTime(msg.createdAt)}</span>
      </div>
      <div className="flex-1 min-w-0">
        {isEditing ? <EditBox /> : (
          <p className="message-content">
            <MessageContent content={msg.content} currentUserId={currentUserId} />
            <EditedLabel />
          </p>
        )}
        {reactionsBar}
      </div>
      <ActionBar />
      <QuickReactPopup />
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

// ─── Search bar + results overlay ────────────────────────────────────────────
function SearchBar({ messages, currentUserId, onClose, onJump }: {
  messages: ChatMessage[];
  currentUserId: string;
  onClose: () => void;
  onJump: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return messages.filter(m => m.content.toLowerCase().includes(q)).slice(0, 20);
  }, [query, messages]);

  // Highlight matching substring
  function highlight(text: string, q: string) {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div className="relative">
      <div className="search-bar">
        <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          placeholder="Search messages in this channel…"
          className="flex-1 bg-transparent text-sm text-text-normal placeholder:text-text-muted outline-none"
        />
        {query && (
          <span className="text-xs text-text-muted mr-1">{results.length} result{results.length !== 1 ? 's' : ''}</span>
        )}
        <button onClick={onClose} className="text-text-muted hover:text-text-normal transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {results.length > 0 && (
        <div className="search-results">
          {results.map(msg => (
            <div
              key={msg.id}
              className="search-result-item"
              onClick={() => { onJump(msg.id); onClose(); }}
            >
              <LazyAvatar name={msg.user.displayName} avatarUrl={msg.user.avatarUrl} size={8} />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-text-normal">{msg.user.displayName}</span>
                  <span className="text-xs text-text-muted">{shortTime(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-text-muted truncate">
                  {highlight(msg.content, query.trim())}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && (
        <div className="search-results">
          <div className="px-4 py-6 text-center text-sm text-text-muted">No messages match &ldquo;{query}&rdquo;</div>
        </div>
      )}
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
    const cursor = e.target.selectionStart;
    const before = v.slice(0, cursor);
    const match  = before.match(/@([\w.]*)$/);
    if (match) { setMentionQuery(match[1]); setActiveIdx(0); }
    else        { setMentionQuery(null); }
    onTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 3000);
  };

  // ── Emoji picker ────────────────────────────────────────────────────────────
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  const insertEmoji = (emoji: { native: string }) => {
    const ta = textareaRef.current;
    if (!ta) {
      setValue(v => v + emoji.native);
      return;
    }
    const start  = ta.selectionStart;
    const end    = ta.selectionEnd;
    const before = value.slice(0, start);
    const after  = value.slice(end);
    const newVal = before + emoji.native + after;
    setValue(newVal);
    setTimeout(() => {
      ta.focus();
      const pos = start + emoji.native.length;
      ta.setSelectionRange(pos, pos);
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }, 0);
  };

  return (
    <div className="message-input-wrapper relative">
      {/* Mention autocomplete */}
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

      {/* Emoji picker */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full right-4 mb-2 z-50 shadow-elevation-high rounded-xl overflow-hidden">
          <EmojiPicker
            data={emojiData}
            onEmojiSelect={insertEmoji}
            theme={useThemeStore.getState().theme === 'light' ? 'light' : 'dark'}
            previewPosition="none"
            skinTonePosition="none"
            maxFrequentRows={2}
            set="native"
          />
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
          {/* Emoji toggle button */}
          <button
            className={`input-action-btn transition-colors ${showEmoji ? 'text-brand' : ''}`}
            title="Emoji"
            onClick={() => setShowEmoji(v => !v)}
          >
            <Smile className="w-4 h-4" />
          </button>
          {/* Send — always brand blue */}
          <button
            onClick={submit}
            className="input-action-btn text-brand hover:opacity-80 transition-opacity"
            title="Send"
          >
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
  const { theme, cycleTheme } = useThemeStore();
  const scrollRef = useScrollToBottom<HTMLDivElement>([messages.length]);
  const { token } = useAuthStore();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const channelName = activeChannelObj?.name ?? 'general';

  // Panel toggles
  const [showSearch, setShowSearch]   = useState(false);
  const [showPinned, setShowPinned]   = useState(false);

  // Delete modal
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

  const handlePin = useCallback(async (msg: ChatMessage) => {
    if (!token) return;
    const newPinned = !msg.pinned;

    // Optimistic: flip the pin indicator in the message list immediately
    useChatStore.getState().applyPinToggle(msg.id, newPinned);

    try {
      const res = await fetch(`/api/messages/${msg.id}/pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('pin failed');

      // Always re-fetch the full pinned list so PinnedPanel is guaranteed correct
      const channel = useUIStore.getState().activeChannel;
      if (channel) {
        const pinned = await fetch(`/api/messages/pinned?channelId=${encodeURIComponent(channel)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).catch(() => null);
        if (Array.isArray(pinned)) useChatStore.getState().setPinnedMessages(pinned);
      }
    } catch {
      // Revert optimistic update on failure
      useChatStore.getState().applyPinToggle(msg.id, !newPinned);
    }
  }, [token]);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleStartEdit = useCallback((id: string) => setEditingId(id), []);
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

  // ── Emoji reactions ────────────────────────────────────────────────────────
  const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);
  const handleOpenReactionPicker  = useCallback((id: string) => setReactingMsgId(id), []);
  const handleCloseReactionPicker = useCallback(() => setReactingMsgId(null), []);

  const handleReact = useCallback(async (msgId: string, emoji: string) => {
    if (!token) return;
    // Optimistic toggle
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

        {/* Search bar (slides in under header) */}
        {showSearch && (
          <SearchBar
            messages={messages}
            currentUserId={user?.id ?? ''}
            onClose={() => setShowSearch(false)}
            onJump={scrollToMessage}
          />
        )}

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
              <button onClick={() => useChatStore.getState().retryMessages()} className="btn btn-ghost btn-sm">
                Retry
              </button>
            </div>
          ) : (
            <>
              <WelcomeBanner channelName={channelName} />
              {groups.map(({ dateLabel, msg, isFirst }) => (
                <div key={msg.id}>
                  {dateLabel && <DateDivider label={dateLabel} />}
                  <Message
                    msg={msg} isFirst={isFirst} currentUserId={user?.id ?? ''}
                    isAdmin={user?.isAdmin ?? false}
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

      {/* Pinned Panel — slides in from right inside the chat column */}
      {showPinned && (
        <PinnedPanel channelName={channelName} onClose={() => setShowPinned(false)} />
      )}
    </div>
  );
}
