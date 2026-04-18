import { memo, useState, useRef, useEffect } from 'react';
import { Pin, Reply, Pencil, Copy, Trash2, SmilePlus } from 'lucide-react';
import { LazyAvatar } from '@/components/LazyAvatar';
import { useMembersStore } from '@/store/useMembersStore';
import type { ChatMessage, RawReaction } from '@/store/useChatStore';
import { formatTimestamp, shortTime, scrollToMessage } from './messageUtils';

// ─── URL regex ────────────────────────────────────────────────────────────────
const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g;

function MessageContent({ content, currentUserId }: { content: string; currentUserId: string }) {
  const { members } = useMembersStore();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
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

function groupReactions(reactions: RawReaction[], currentUserId: string) {
  const map = new Map<string, { count: number; hasMe: boolean }>();
  for (const r of reactions) {
    const cur = map.get(r.emoji) ?? { count: 0, hasMe: false };
    map.set(r.emoji, { count: cur.count + 1, hasMe: cur.hasMe || r.userId === currentUserId });
  }
  return Array.from(map.entries()).map(([emoji, { count, hasMe }]) => ({ emoji, count, hasMe }));
}

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
        <SmilePlus className="w-4 h-4" />
      </button>
    </div>
  );
}

export interface MessageItemProps {
  msg: ChatMessage;
  isFirst: boolean;
  currentUserId: string;
  isAdmin: boolean;
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
}

const QUICK_EMOJIS = ['😂', '😢', '😎', '💀', '❤️'];

export const MessageItem = memo(function MessageItem({
  msg, isFirst, currentUserId, isAdmin: currentUserIsAdmin,
  onDelete, onReply, onPin, onStartEdit, editingId, onSaveEdit, onCancelEdit,
  onReact, reactingMsgId, onOpenReactionPicker, onCloseReactionPicker,
}: MessageItemProps) {
  const isMe       = msg.userId === currentUserId;
  const canDelete  = isMe || currentUserIsAdmin;
  const canPin     = isMe || currentUserIsAdmin;   // author or admin can pin
  const isEditing  = editingId === msg.id;
  const pickerOpen = reactingMsgId === msg.id;

  const [editValue, setEditValue] = useState('');
  const editRef   = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync editValue when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditValue(msg.content);
      requestAnimationFrame(() => {
        const ta = editRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
      });
    }
  }, [isEditing]);

  // Picker outside-click close
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

  // inline edit JSX — defined as a variable, NOT a component, so React never unmounts the textarea
  const editBoxJSX = (
    <div className="mt-1 pr-4">
      <textarea
        ref={editRef}
        value={editValue}
        onChange={handleEditInput}
        onKeyDown={handleEditKeyDown}
        onFocus={(e) => e.target.select()}
        className="message-edit-textarea w-full"
        rows={1}
      />
      <p className="message-edit-hint">
        <span
          className="text-brand cursor-pointer hover:underline"
          onClick={() => { const t = editValue.trim(); if (t && t !== msg.content) onSaveEdit(msg.id, t); else onCancelEdit(); }}
        >
          save
        </span>
        &nbsp;—&nbsp;
        <span className="cursor-pointer hover:underline" onClick={onCancelEdit}>esc to cancel</span>
      </p>
    </div>
  );

  const EditedLabel = () => msg.editedAt ? <span className="message-edited-label">(edited)</span> : null;

  const ActionBar = () => (
    <div className="message-actions">
      <button
        className={`message-action-btn ${pickerOpen ? 'text-brand' : ''}`}
        title="React"
        onMouseDown={(e) => { e.stopPropagation(); pickerOpen ? onCloseReactionPicker() : onOpenReactionPicker(msg.id); }}
      >
        <SmilePlus className="w-4 h-4" />
      </button>
      <button className="message-action-btn" title="Reply" onClick={() => onReply(msg)}>
        <Reply className="w-4 h-4" />
      </button>
      {isMe && (
        <button className="message-action-btn" title="Edit"
          onClick={() => onStartEdit(msg.id)}>
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {canPin && (
        <button
          className={`message-action-btn ${msg.pinned ? 'text-brand' : ''}`}
          title={msg.pinned ? 'Unpin' : 'Pin'} onClick={() => onPin(msg)}
        >
          <Pin className="w-4 h-4" />
        </button>
      )}
      <button className="message-action-btn" title="Copy"
        onClick={() => navigator.clipboard.writeText(msg.content)}>
        <Copy className="w-4 h-4" />
      </button>
      {canDelete && (
        <button className="message-action-btn hover:!text-status-red" title="Delete"
          onClick={() => onDelete(msg.id)}>
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

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
              {msg.pinned && (
                <span className="inline-flex items-center gap-0.5 text-2xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgb(var(--brand-rgb)/0.15)', color: 'rgb(var(--brand-rgb))' }}>
                  <Pin className="w-3 h-3" /> Pinned
                </span>
              )}
            </div>
            {isEditing ? editBoxJSX : (
              <p className="message-content">
                <MessageContent content={msg.content} currentUserId={currentUserId} />
                {msg.editedAt ? <span className="message-edited-label">(edited)</span> : null}
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
        {isEditing ? editBoxJSX : (
          <p className="message-content">
            <MessageContent content={msg.content} currentUserId={currentUserId} />
            {msg.editedAt ? <span className="message-edited-label">(edited)</span> : null}
            {msg.pinned && (
              <span className="inline-flex items-center gap-0.5 text-2xs font-medium px-1.5 py-0.5 rounded-full ml-1.5 align-middle flex-shrink-0"
                    style={{ background: 'rgb(var(--brand-rgb)/0.15)', color: 'rgb(var(--brand-rgb))' }}>
                <Pin className="w-2.5 h-2.5" /> Pinned
              </span>
            )}
          </p>
        )}
        {reactionsBar}
      </div>
      <ActionBar />
      <QuickReactPopup />
    </div>
  );
}, (prev, next) => {
  return (
    prev.msg === next.msg &&
    prev.isFirst === next.isFirst &&
    prev.currentUserId === next.currentUserId &&
    prev.isAdmin === next.isAdmin &&
    (prev.editingId === prev.msg.id) === (next.editingId === next.msg.id) &&
    (prev.reactingMsgId === prev.msg.id) === (next.reactingMsgId === next.msg.id)
  );
});
