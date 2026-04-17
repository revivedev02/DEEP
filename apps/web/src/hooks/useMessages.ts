import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useUIStore } from '@/store/useUIStore';

/** Minimum time (ms) the skeleton loader is guaranteed to be visible. */
const MIN_SKELETON_MS = 400;

/** Fetches messages for the active channel. Re-fetches when channel switches. */
export function useMessages() {
  const { token } = useAuthStore();
  const { clearMessages, setLoadError, prependMessages, setLoadingOlder } = useChatStore();
  const retryTick = useChatStore(s => s.retryTick);
  const { activeChannel } = useUIStore();

  // Initial load — latest 50 messages
  useEffect(() => {
    if (!token || !activeChannel) return;

    // Show skeleton — clearMessages sets isLoadingMessages:true AND loadError:null
    clearMessages();

    const start = Date.now();
    let cancelled = false;

    fetch(`/api/messages?channelId=${encodeURIComponent(activeChannel)}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(msgs => {
        if (cancelled) return;
        const data = Array.isArray(msgs) ? msgs : [];
        // Ensure skeleton stays visible for at least MIN_SKELETON_MS
        const elapsed = Date.now() - start;
        const wait = Math.max(0, MIN_SKELETON_MS - elapsed);
        if (wait > 0) {
          setTimeout(() => {
            if (!cancelled) useChatStore.getState().setMessages(data);
          }, wait);
        } else {
          useChatStore.getState().setMessages(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(navigator.onLine ? 'Failed to load messages.' : 'You are offline.');
        }
      });

    // Cleanup — prevent stale responses when switching channels fast
    return () => { cancelled = true; };
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
