import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useUIStore } from '@/store/useUIStore';

/** Fetches messages for the active channel. Re-fetches when channel switches. */
export function useMessages() {
  const { token } = useAuthStore();
  const { setMessages, setLoadingMessages, setLoadError, prependMessages, setLoadingOlder } = useChatStore();
  const retryTick = useChatStore(s => s.retryTick);
  const { activeChannel } = useUIStore();

  // Initial load — latest 50 messages
  useEffect(() => {
    if (!token || !activeChannel) return;

    setLoadingMessages(true);
    setLoadError(null);
    setMessages([]);

    fetch(`/api/messages?channelId=${encodeURIComponent(activeChannel)}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(msgs => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch((err: Error) => setLoadError(
        navigator.onLine ? 'Failed to load messages.' : 'You are offline.'
      ));
  }, [token, activeChannel, retryTick]);

  // Load older messages (for infinite scroll)
  const loadOlderMessages = useCallback(async () => {
    if (!token || !activeChannel) return;
    const { messages, isLoadingOlder, hasMore } = useChatStore.getState();
    if (isLoadingOlder || !hasMore || messages.length === 0) return;

    const oldestId = messages[0].id;
    setLoadingOlder(true);

    try {
      const res = await fetch(
        `/api/messages?channelId=${encodeURIComponent(activeChannel)}&limit=50&before=${oldestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const olderMsgs = await res.json();
      prependMessages(Array.isArray(olderMsgs) ? olderMsgs : []);
    } catch {
      setLoadingOlder(false);
    }
  }, [token, activeChannel]);

  return { loadOlderMessages };
}
