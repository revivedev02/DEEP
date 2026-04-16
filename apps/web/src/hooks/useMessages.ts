import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useUIStore } from '@/store/useUIStore';

/** Fetches messages for the active channel. Re-fetches when channel switches. */
export function useMessages() {
  const { token } = useAuthStore();
  const { setMessages, setLoadingMessages } = useChatStore();
  const { activeChannel } = useUIStore();

  useEffect(() => {
    if (!token || !activeChannel) return;

    // Clear messages immediately when switching channels
    setMessages([]);
    setLoadingMessages(true);

    fetch(`/api/messages?channelId=${encodeURIComponent(activeChannel)}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(msgs => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => setLoadingMessages(false));
  }, [token, activeChannel]);
}
