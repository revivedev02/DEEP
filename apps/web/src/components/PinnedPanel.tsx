import { useEffect } from 'react';
import { Pin, X, ExternalLink } from 'lucide-react';
import { LazyAvatar } from '@/components/LazyAvatar';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useUIStore } from '@/store/useUIStore';

const IST = 'Asia/Kolkata';
const pinTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST,
});

function scrollToMessage(id: string) {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('message-flash');
  setTimeout(() => el.classList.remove('message-flash'), 1800);
}

interface Props {
  onClose: () => void;
  channelName: string;
}

export default function PinnedPanel({ onClose, channelName }: Props) {
  const { pinnedMessages, setPinnedMessages } = useChatStore();
  const { user, token } = useAuthStore();
  const { activeChannel } = useUIStore();
  const isAdmin = user?.isAdmin ?? false;

  // Fetch pinned messages for this channel
  useEffect(() => {
    if (!token || !activeChannel) return;
    fetch(`/api/messages/pinned?channelId=${encodeURIComponent(activeChannel)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setPinnedMessages(Array.isArray(data) ? data : []))
      .catch(() => setPinnedMessages([]));
  }, [token, activeChannel]);

  const handleUnpin = async (messageId: string) => {
    if (!token) return;
    await fetch(`/api/messages/${messageId}/pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    // Optimistic: applyPinToggle will also be called via socket event
    useChatStore.getState().applyPinToggle(messageId, false);
  };

  return (
    <div className="pins-panel animate-fade-in">
      {/* Header */}
      <div className="pins-panel-header">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-brand" />
          <span className="font-semibold text-text-normal text-sm">Pinned Messages</span>
          <span className="ml-1 text-xs text-text-muted">#{channelName}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-text-muted hover:text-text-normal hover:bg-bg-modifier transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {pinnedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-bg-modifier flex items-center justify-center">
              <Pin className="w-5 h-5 text-text-muted" />
            </div>
            <p className="text-text-muted text-sm">No pinned messages in <strong className="text-text-normal">#{channelName}</strong>.</p>
            {isAdmin && <p className="text-text-muted text-xs">Hover a message and click the 📌 pin button to pin it.</p>}
          </div>
        ) : (
          pinnedMessages.map((msg) => (
            <div key={msg.id} className="pin-item group">
              <div className="pin-item-header">
                <LazyAvatar name={msg.user.displayName} avatarUrl={msg.user.avatarUrl} size={6} />
                <span className="text-sm font-medium text-text-normal">{msg.user.displayName}</span>
                <span className="text-xs text-text-muted ml-auto">
                  {pinTimeFmt.format(new Date(msg.createdAt))}
                </span>
              </div>
              <p className="text-sm text-text-muted line-clamp-3 leading-relaxed pl-8">
                {msg.content}
              </p>
              <div className="flex items-center gap-2 pl-8 mt-1">
                <button
                  onClick={() => { scrollToMessage(msg.id); onClose(); }}
                  className="text-xs text-brand hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Jump to message
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleUnpin(msg.id)}
                    className="text-xs text-text-muted hover:text-status-red transition-colors ml-auto"
                  >
                    Unpin
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
