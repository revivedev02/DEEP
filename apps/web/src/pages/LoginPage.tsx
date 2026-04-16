import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [shortId, setShortId] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showId, setShowId]   = useState(false);

  const handleLogin = async () => {
    const trimmed = shortId.trim();
    if (!trimmed) { setError('Please enter your member ID.'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ shortId: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Invalid member ID.');
        setLoading(false);
        return;
      }

      login(data.token, data.user);
      navigate('/');
    } catch {
      setError('Cannot reach the server. Make sure the backend is running on port 3000.');
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="login-bg h-full">
      {/* Grid decoration */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#5865F2 1px, transparent 1px), linear-gradient(90deg, #5865F2 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="login-card relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-[20px] bg-brand flex items-center justify-center mb-4 glow-brand animate-bounce-in">
            <span className="text-white text-3xl font-bold select-none">D</span>
          </div>
          <h1 className="text-2xl font-bold text-text-normal">Welcome to DEEP</h1>
          <p className="text-text-muted text-sm mt-1">Invite-only — Enter your Member ID to continue</p>
        </div>

        {/* Input */}
        <div className="space-y-4">
          <div>
            <label className="form-label" htmlFor="short-id">
              <Lock className="w-3 h-3 inline mr-1" />
              Member ID
            </label>
            <div className="relative">
              <input
                id="short-id"
                type={showId ? 'text' : 'password'}
                value={shortId}
                onChange={e => { setShortId(e.target.value); setError(''); }}
                onKeyDown={handleKey}
                placeholder="e.g. usr_abc123"
                className="form-input pr-10 font-mono"
                autoComplete="off"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowId(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-normal transition-colors"
              >
                {showId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="form-hint">No password needed — your ID is your key. Ask your admin if you need one.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-status-red/10 border border-status-red/30 text-status-red text-sm animate-fade-in">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !shortId.trim()}
            className="btn-primary w-full py-3 text-base font-semibold"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Signing in…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Sign In <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-text-muted mt-6">
          Don't have an ID? Contact your server admin.
        </p>
      </div>
    </div>
  );
}
