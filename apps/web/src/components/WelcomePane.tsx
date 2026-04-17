import { useEffect, useState } from 'react';
import { useServerStore } from '@/store/useServerStore';
import { useAuthStore } from '@/store/useAuthStore';

// ── Typewriter hook ─────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 80, startDelay = 300) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone]           = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!text) return;

    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(interval); setDone(true); }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);

  return { displayed, done };
}

// ── Floating particles ─────────────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size:  Math.random() * 3 + 1,
    x:     Math.random() * 100,
    delay: Math.random() * 6,
    dur:   Math.random() * 8 + 8,
    opacity: Math.random() * 0.4 + 0.1,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-brand/30"
          style={{
            width:  p.size,
            height: p.size,
            left:   `${p.x}%`,
            bottom: '-10px',
            opacity: p.opacity,
            animation: `welcome-float ${p.dur}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Lock badge ─────────────────────────────────────────────────────────────
function PrivateBadge() {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/10 backdrop-blur-sm">
      <svg className="w-3.5 h-3.5 text-brand flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span className="text-xs font-semibold text-brand tracking-widest uppercase">Private — Invite Only</span>
    </div>
  );
}

// ── Stat pill ──────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-3 rounded-xl bg-bg-secondary border border-separator/40">
      <span className="text-xl font-bold text-text-normal">{value}</span>
      <span className="text-xs text-text-muted mt-0.5">{label}</span>
    </div>
  );
}

// ── Main welcome pane ──────────────────────────────────────────────────────
export default function WelcomePane() {
  const { serverName, iconUrl } = useServerStore();
  const { user }                = useAuthStore();
  const { displayed, done }     = useTypewriter(serverName, 90, 400);

  return (
    <div className="welcome-pane">
      <Particles />

      {/* Radial glow behind content */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(var(--brand-rgb) / 0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-2xl mx-auto">

        {/* Server icon */}
        <div className="welcome-icon mb-8">
          {iconUrl ? (
            <img src={iconUrl} alt={serverName} className="w-full h-full object-cover rounded-[28px]" />
          ) : (
            <span className="text-4xl font-black text-white select-none">
              {serverName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        {/* Private badge */}
        <PrivateBadge />

        {/* Animated server name */}
        <h1 className="welcome-title mt-6">
          {displayed}
          <span className={`welcome-cursor ${done ? 'welcome-cursor-hide' : ''}`}>|</span>
        </h1>

        {/* Tagline */}
        <p
          className="welcome-tagline"
          style={{ animationDelay: `${400 + serverName.length * 90 + 300}ms` }}
        >
          A closed space for the people who matter.
          <br />
          <span className="text-text-muted">
            Welcome back, <strong className="text-text-normal">{user?.displayName}</strong>.
          </span>
        </p>

        {/* Stats row */}
        <div
          className="flex items-center gap-3 mt-10"
          style={{ animation: 'welcome-slide-up 0.5s ease both', animationDelay: `${400 + serverName.length * 90 + 700}ms` }}
        >
          <StatPill label="Your Handle" value={`@${user?.username}`} />
          <StatPill label="Status" value="Member" />
          <StatPill label="Access" value="Full" />
        </div>

        {/* Hint */}
        <p
          className="mt-10 text-xs text-text-muted tracking-wide opacity-0"
          style={{ animation: 'welcome-fade 0.4s ease forwards', animationDelay: `${400 + serverName.length * 90 + 1100}ms` }}
        >
          ← Pick a channel from the sidebar to get started
        </p>
      </div>
    </div>
  );
}
