import { useState, useRef, useEffect } from 'react';
import { Hash, Volume2, ChevronDown, LogOut, Mic, Headphones, Shield, Settings, X, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore, CHANNELS } from '@/store/useUIStore';
import { useChatStore } from '@/store/useChatStore';

// ── Avatar helper ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['bg-brand','bg-purple-600','bg-green-600','bg-orange-500','bg-pink-600','bg-cyan-600'];
function UserAvatar({ name }: { name: string }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 select-none`}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

// ── Server header dropdown ────────────────────────────────────────────────────
function ServerDropdown({ onClose }: { onClose: () => void }) {
  const navigate   = useNavigate();
  const { user, logout } = useAuthStore();

  const go = (path: string) => { onClose(); navigate(path); };
  const handleLogout = () => { onClose(); logout(); navigate('/login'); };

  return (
    <div className="absolute top-full left-2 right-2 mt-1 z-50 bg-bg-floating border border-separator/60
                    rounded-lg shadow-elevation-high py-1.5 animate-slide-up">
      {user?.isAdmin && (
        <>
          <button
            onClick={() => go('/admin')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-normal
                       hover:bg-brand hover:text-white transition-colors duration-100 rounded mx-0"
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            Admin Panel
          </button>
          <button
            onClick={() => go('/admin')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-normal
                       hover:bg-bg-modifier transition-colors duration-100"
          >
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            Invite Member
          </button>
          <div className="my-1.5 mx-3 h-px bg-separator" />
        </>
      )}
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-normal
                   hover:bg-bg-modifier transition-colors duration-100"
      >
        <Settings className="w-4 h-4 flex-shrink-0" />
        Server Settings
        <span className="ml-auto text-2xs text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">Soon</span>
      </button>
      <div className="my-1.5 mx-3 h-px bg-separator" />
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-status-red
                   hover:bg-status-red/10 transition-colors duration-100"
      >
        <LogOut className="w-4 h-4 flex-shrink-0" />
        Log Out
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChannelSidebar() {
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const { activeChannel, setActiveChannel } = useUIStore();
  const { isConnected } = useChatStore();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  return (
    <aside className="channel-sidebar">
      {/* ── Server header with dropdown ─────────────────────────────────── */}
      <div ref={dropRef} className="relative">
        <button
          onClick={() => setDropOpen(v => !v)}
          className="sidebar-header w-full text-left"
        >
          <span className="text-base font-bold text-text-normal truncate tracking-wide">DEEP</span>
          {dropOpen
            ? <X          className="w-4 h-4 text-text-muted flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
          }
        </button>
        {dropOpen && <ServerDropdown onClose={() => setDropOpen(false)} />}
      </div>

      {/* ── Channel list ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {/* Text */}
        <div className="sidebar-section-title">
          <ChevronDown className="w-3 h-3" />
          <span>Text Channels</span>
        </div>

        {CHANNELS.filter(c => c.type === 'text').map(ch => (
          <div
            key={ch.id}
            onClick={() => setActiveChannel(ch.id as any)}
            className={`channel-item ${activeChannel === ch.id ? 'active' : ''}`}
          >
            <Hash className="channel-icon w-5 h-5" />
            <span>{ch.name}</span>
          </div>
        ))}

        {/* Voice */}
        <div className="sidebar-section-title mt-3">
          <ChevronDown className="w-3 h-3" />
          <span>Voice Channels</span>
        </div>

        {CHANNELS.filter(c => c.type === 'voice').map(ch => (
          <div
            key={ch.id}
            onClick={() => setActiveChannel(ch.id as any)}
            className={`channel-item ${activeChannel === ch.id ? 'active' : ''}`}
          >
            <Volume2 className="channel-icon w-5 h-5" />
            <span>{ch.name}</span>
            <span className="ml-auto text-2xs text-text-muted font-medium bg-bg-tertiary px-1.5 py-0.5 rounded">
              Soon
            </span>
          </div>
        ))}
      </div>

      {/* ── User panel ──────────────────────────────────────────────────── */}
      <div className="user-panel group">
        <div className="avatar">
          <UserAvatar name={user?.displayName ?? 'U'} />
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold text-text-normal truncate leading-tight">
            {user?.displayName}
          </span>
          <span className="text-xs text-text-muted truncate leading-tight">
            #{user?.username}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button title="Mute (coming soon)"  className="input-action-btn w-7 h-7"><Mic       className="w-4 h-4" /></button>
          <button title="Deafen (coming soon)" className="input-action-btn w-7 h-7"><Headphones className="w-4 h-4" /></button>
        </div>
      </div>
    </aside>
  );
}
