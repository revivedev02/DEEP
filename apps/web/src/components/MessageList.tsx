import { useMemo, useRef, useCallback, useEffect } from 'react';
import { WifiOff, Hash } from 'lucide-react';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { SkMessageList } from '@/components/Skeleton';
import { useScrollToBottom } from '@/hooks/useScrollToBottom';
import { MessageItem, type MessageItemProps } from '@/components/MessageItem';
import { isTodayIST, isYesterdayIST, isSameAuthorWithin5Min, IST } from './messageUtils';

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

type MessageHandlers = Omit<MessageItemProps, 'msg' | 'isFirst' | 'currentUserId' | 'isAdmin'>;

interface MessageListProps extends MessageHandlers {
  currentUserId: string;
  isAdmin: boolean;
  channelName: string;
  onLoadOlder: () => void;
}

export function MessageList({
  currentUserId, isAdmin, channelName, onLoadOlder, ...handlers
}: MessageListProps) {
  const { messages, isLoadingMessages, isLoadingOlder, hasMore, loadError } = useChatStore();
  const scrollRef = useScrollToBottom<HTMLDivElement>([messages.length]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wasLoadingOlderRef = useRef(false);
  const prevMsgCountRef    = useRef(messages.length);

  // Keep wasLoadingOlderRef in sync
  useEffect(() => {
    wasLoadingOlderRef.current = isLoadingOlder;
  }, [isLoadingOlder]);

  // Preserve scroll position ONLY when older messages are prepended (batch load).
  // Single-message appends (send/receive) are handled by useScrollToBottom — no upward jump.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const prevCount = prevMsgCountRef.current;
    const delta = messages.length - prevCount;

    if (delta > 1 && prevCount > 0) {
      // Batch prepend (older messages loaded) — anchor to first previously-visible message
      const anchorMsg = messages[delta];
      if (anchorMsg) {
        const msgEl = document.getElementById(`msg-${anchorMsg.id}`);
        if (msgEl) requestAnimationFrame(() => msgEl.scrollIntoView({ block: 'start' }));
      }
    }
    // delta === 1: single new message → useScrollToBottom smoothly scrolls to bottom

    prevMsgCountRef.current = messages.length;
  }, [messages.length]);


  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollTop < 100 && hasMore && !isLoadingOlder) onLoadOlder();
  }, [hasMore, isLoadingOlder, onLoadOlder]);

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
    <div
      ref={(el) => {
        (scrollRef as any).current = el;
        (scrollContainerRef as any).current = el;
      }}
      className="messages-container scrollbar-thin"
      onScroll={handleScroll}
    >
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
          {isLoadingOlder && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!hasMore && <WelcomeBanner channelName={channelName} />}
          {groups.map(({ dateLabel, msg, isFirst }) => (
            <div key={msg.id}>
              {dateLabel && <DateDivider label={dateLabel} />}
              <MessageItem
                msg={msg} isFirst={isFirst}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                {...handlers}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
