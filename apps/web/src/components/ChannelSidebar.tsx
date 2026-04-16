import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Shield, LogOut, Hash, Mic, ChevronRight, Camera } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore, type Channel } from '@/store/useServerStore';
import { SkChannelSidebar } from '@/components/Skeleton';
import { LazyAvatar } from '@/components/LazyAvatar';
import AvatarUploadModal from '@/components/AvatarUploadModal';

// ── Channel row ─────────────────────────────────────────────────────────────
function ChannelItem({ channel, active, onSelect }: {
  channel: Channel; active: boolean; onSelect: () => void;
}) {
  const Icon = channel.type === 'voice' ? Mic : Hash;
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 py-1.5 pr-2 mr-2 cursor-pointer transition-all duration-150 select-none rounded-r border-l-2
        ${ active
          ? 'bg-bg-active text-text-normal border-brand pl-[7px]'
          : 'text-text-muted hover:bg-bg-hover hover:text-text-normal border-transparent pl-[7px]'
        }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
      <span className="flex-1 text-sm truncate">{channel.name}</span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center px-4 py-1">
      <span className="flex-1 text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ChannelSidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { activeChannel, setActiveChannel, showMembers, toggleMembers } = useUIStore();
  const { serverName, iconUrl, channels, isLoading } = useServerStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const isAdmin = user?.isAdmin ?? false;

  const textChannels  = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  return (
    <aside className="channel-sidebar flex flex-col h-full">
      {/* ── Server header ── */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-separator hover:bg-bg-hover transition-colors duration-150"
        >
          {/* Server icon */}
          {isLoading ? (
            <div className="skeleton w-7 h-7 rounded-lg flex-shrink-0" />
          ) : iconUrl ? (
            <img src={iconUrl} alt={serverName} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
              {serverName.slice(0, 1).toUpperCase()}
            </div>
          )}
          {/* Server name */}
          {isLoading
            ? <div className="skeleton w-24 h-4" />
            : <span className="font-bold text-text-normal truncate">{serverName}</span>}
          <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
            <div className="dropdown-menu absolute top-full left-2 right-2 z-40 animate-fade-in">
              {isAdmin && (
                <>
                  <button className="dropdown-item" onClick={() => { navigate('/admin'); setDropdownOpen(false); }}>
                    <Shield className="w-4 h-4" /> Admin Panel
                  </button>
                  <div className="dropdown-divider" />
                </>
              )}
              <button className="dropdown-item" onClick={() => { toggleMembers(); setDropdownOpen(false); }}>
                <ChevronRight className={`w-4 h-4 transition-transform duration-150 ${showMembers ? 'rotate-90' : ''}`} />
                {showMembers ? 'Hide Members' : 'Show Members'}
              </button>
              <div className="dropdown-divider" />
              <button className="dropdown-item text-status-red" onClick={() => { logout(); navigate('/login'); }}>
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Channel list ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {isLoading ? (
          <SkChannelSidebar />
        ) : (
          <>
            <SectionHeader label="Text Channels" />
            {textChannels.map(ch => (
              <ChannelItem key={ch.id} channel={ch} active={activeChannel === ch.id} onSelect={() => setActiveChannel(ch.id)} />
            ))}

            <div className="mt-4" />
            <SectionHeader label="Voice Channels" />
            {voiceChannels.map(ch => (
              <ChannelItem key={ch.id} channel={ch} active={activeChannel === ch.id} onSelect={() => setActiveChannel(ch.id)} />
            ))}
          </>
        )}
      </div>

      {/* ── User footer ── */}
      <div className="px-3 py-2 flex items-center gap-2 border-t border-separator/40 bg-bg-secondary flex-shrink-0">
        {/* Clickable avatar with LazyAvatar + camera overlay */}
        <div
          className="relative cursor-pointer group flex-shrink-0"
          onClick={() => setShowAvatarModal(true)}
          title="Change avatar"
        >
          <LazyAvatar name={user?.displayName ?? '?'} avatarUrl={user?.avatarUrl} size={8} />
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-text-normal truncate">{user?.displayName}</span>
          <span className="text-xs text-text-muted truncate">#{user?.username}</span>
        </div>
      </div>

      {/* Avatar upload modal */}
      {showAvatarModal && (
        <AvatarUploadModal onClose={() => setShowAvatarModal(false)} />
      )}
    </aside>
  );
}
