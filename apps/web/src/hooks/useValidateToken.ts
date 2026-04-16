import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * On mount, validates the stored JWT against /api/me.
 * If the server returns 401 (expired / invalid / demo token), 
 * clears auth and redirects to login automatically.
 */
export function useValidateToken() {
  const { token, logout, login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;

    fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (r.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        if (r.ok) {
          const user = await r.json();
          // Refresh user info in store (handles display name changes etc.)
          login(token, user);
        }
      })
      .catch(() => {
        // Server offline — keep user logged in, they'll see "offline" status
      });
  }, []);
}
