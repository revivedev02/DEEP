import { useState, useRef, useEffect } from 'react';
import { Smile, Paperclip, Gift, Sticker, Send, AtSign, X, Image, Film } from 'lucide-react';
import { LazyAvatar } from '@/components/LazyAvatar';
import { useMembersStore } from '@/store/useMembersStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { useDMStore, type DMMessage } from '@/store/useDMStore';
import { uploadMedia, validateMediaFile } from '@/lib/uploadMedia';
import type { UploadedMedia } from '@/lib/uploadMedia';
// @ts-ignore — emoji-mart has no bundled types for the React wrapper
import EmojiPicker from '@emoji-mart/react';
import emojiData from '@emoji-mart/data';

interface MessageInputProps {
  onSend:        (content: string, media?: UploadedMedia) => void;
  channelName:   string;
  onTyping:      (v: boolean) => void;
  onCancelReply: () => void;
}

export function MessageInput({ onSend, channelName, onTyping, onCancelReply }: MessageInputProps) {
  const [value, setValue]               = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIdx, setActiveIdx]       = useState(0);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout>>();
  const { members }  = useMembersStore();
  const { token }    = useAuthStore();

  // ── Staged media (selected, not yet sent) ───────────────────────────────────
  const [stagedFile,    setStagedFile]    = useState<File | null>(null);
  const [stagedPreview, setStagedPreview] = useState<string | null>(null);
  const [stagedType,    setStagedType]    = useState<'image' | 'video' | null>(null);
  const [uploadError,   setUploadError]   = useState<string | null>(null);

  const clearStaged = () => {
    if (stagedPreview) URL.revokeObjectURL(stagedPreview);
    setStagedFile(null);
    setStagedPreview(null);
    setStagedType(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateMediaFile(file);
    if (err) { setUploadError(err); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
    setUploadError(null);
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    setStagedFile(file);
    setStagedType(type);
    setStagedPreview(URL.createObjectURL(file));
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // ── Mention autocomplete ────────────────────────────────────────────────────
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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed && !stagedFile) return;

    if (stagedFile) {
      // Snapshot everything before clearing UI
      const fileSnapshot  = stagedFile;
      const typeSnapshot  = stagedType!;
      const captionSnapshot = trimmed;

      // 1. Create a local blob URL for the optimistic preview
      const localUrl  = URL.createObjectURL(fileSnapshot);
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // 2. Build the optimistic message
      const { user }                              = useAuthStore.getState();
      const { activeChannel, activeDmConversation } = useUIStore.getState();
      const isDM = !!activeDmConversation;

      const optimisticBase = {
        id:        pendingId,
        pendingId,
        pending:   true,
        content:   captionSnapshot,
        mediaUrl:  localUrl,
        mediaType: typeSnapshot,
        userId:    user?.id ?? '',
        createdAt: new Date().toISOString(),
        editedAt:  null,
        pinned:    false,
        reactions: [],
        replyToId: null,
        replyTo:   null,
        user: {
          id:          user?.id ?? '',
          displayName: (user as any)?.displayName ?? '',
          username:    (user as any)?.username    ?? '',
          avatarUrl:   (user as any)?.avatarUrl   ?? null,
          isAdmin:     (user as any)?.isAdmin     ?? false,
        },
      };

      if (isDM) {
        useDMStore.getState().addPendingMessage({
          ...optimisticBase,
          conversationId: activeDmConversation!,
        } as DMMessage);
      } else {
        useChatStore.getState().addPendingMessage({
          ...optimisticBase,
          channelId: activeChannel,
        } as ChatMessage);
      }

      // 3. Clear UI immediately — user can type the next message now
      clearStaged();
      setValue('');
      setMentionQuery(null);
      onTyping(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      // 4. Upload in background (fire-and-forget, no await)
      uploadMedia(fileSnapshot, token ?? '')
        .then(media => {
          // Remove the pending message first, then emit the real one
          if (isDM) useDMStore.getState().removePendingMessage(pendingId);
          else      useChatStore.getState().removePendingMessage(pendingId);

          URL.revokeObjectURL(localUrl);
          onSend(captionSnapshot, media);
        })
        .catch((err: unknown) => {
          // Upload failed → remove pending, restore UI
          if (isDM) useDMStore.getState().removePendingMessage(pendingId);
          else      useChatStore.getState().removePendingMessage(pendingId);

          URL.revokeObjectURL(localUrl);

          // Restore staged file so user can retry
          setStagedFile(fileSnapshot);
          setStagedType(typeSnapshot);
          setStagedPreview(URL.createObjectURL(fileSnapshot));
          setValue(captionSnapshot);
          setUploadError(err instanceof Error ? err.message : 'Upload failed. Try again.');
        });

    } else {
      // Text-only
      onSend(trimmed);
      setValue('');
      setMentionQuery(null);
      onTyping(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  // ── Emoji picker ────────────────────────────────────────────────────────────
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  const insertEmoji = (emoji: { native: string }) => {
    const ta = textareaRef.current;
    if (!ta) { setValue(v => v + emoji.native); return; }
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

  const canSend = value.trim().length > 0 || !!stagedFile;

  return (
    <div className="message-input-wrapper relative">

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={handleFileSelect}
      />

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

      {/* Upload error toast */}
      {uploadError && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-status-red/15 border border-status-red/30 text-sm text-status-red flex items-center gap-2">
          <span className="flex-1">{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="flex-shrink-0 hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Staged media preview */}
      {stagedFile && (
        <div className="media-upload-preview">
          <div className="media-upload-preview-inner">
            {stagedType === 'image' && stagedPreview ? (
              <img src={stagedPreview} alt="preview" className="media-preview-img" />
            ) : (
              <div className="media-preview-video-ph">
                <Film className="w-6 h-6 text-text-muted" />
              </div>
            )}
            <div className="media-preview-meta">
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                {stagedType === 'image' ? <Image className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                <span className="truncate max-w-[140px]">{stagedFile.name}</span>
                <span className="opacity-60">· {(stagedFile.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            </div>
            <button className="media-preview-remove" onClick={clearStaged} title="Remove">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="message-input-box">
        <button className="input-action-btn" title="Attach image or video" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="w-5 h-5" />
        </button>

        <textarea
          ref={textareaRef} value={value} onChange={handleInput} onKeyDown={handleKeyDown}
          placeholder={stagedFile ? 'Add a caption… (optional)' : `Message #${channelName}`}
          className="message-input" rows={1}
        />

        <div className="flex items-center gap-1">
          <button className="input-action-btn" title="Gift (coming soon)"><Gift className="w-4 h-4" /></button>
          <button className="input-action-btn" title="Sticker (coming soon)"><Sticker className="w-4 h-4" /></button>
          <button
            className={`input-action-btn transition-colors ${showEmoji ? 'text-brand' : ''}`}
            title="Emoji"
            onClick={() => setShowEmoji(v => !v)}
          >
            <Smile className="w-4 h-4" />
          </button>
          <button
            onClick={submit}
            className={`send-btn ${canSend ? '' : 'opacity-40 cursor-not-allowed'}`}
            title="Send"
            disabled={!canSend}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
