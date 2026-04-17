import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useServerStore } from '@/store/useServerStore';
import { useUIStore } from '@/store/useUIStore';

/** Fetches server name + channels on mount. Sets default active channel. */
export function useServerData() {
  const { token } = useAuthStore();
  const { setServerName, setIconUrl, setChannels, setLoading } = useServerStore();
  const { setActiveChannel } = useUIStore();

  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    // Fetch settings
    fetch('/api/settings', { headers })
      .then(r => r.json())
      .then(data => {
        if (data.serverName) setServerName(data.serverName);
        if (data.iconUrl)    setIconUrl(data.iconUrl);
      })
      .catch(() => {});

    // Fetch channels — read activeChannel from store at call time to avoid stale closure
    fetch('/api/channels', { headers })
      .then(r => r.json())
      .then(data => {
        setLoading(false);
        if (!Array.isArray(data) || data.length === 0) return;
        setChannels(data);
        const { activeChannel } = useUIStore.getState();
        if (!activeChannel) {
          const first = data.find((c: any) => c.type === 'text');
          if (first) setActiveChannel(first.id);
        }
      })
      .catch(() => setLoading(false));
  }, [token]);
}

