import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';

/** Fetches the last 50 messages from the real API on mount. */
export function useMessages() {
  const { token } = useAuthStore();
  const { setMessages, setLoadingMessages } = useChatStore();

  useEffect(() => {
    if (!token) return;

    setLoadingMessages(true);
    fetch('/api/messages?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(msgs => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => setLoadingMessages(false));
  }, [token]);
}
