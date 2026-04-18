import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Shield, LogOut, Hash, Mic, Camera, Settings } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore, type Channel } from '@/store/useServerStore';
import { SkChannelSidebar } from '@/components/Skeleton';
import { LazyAvatar } from '@/components/LazyAvatar';
import AvatarUploadModal from '@/components/AvatarUploadModal';
import AccountSettingsModal from '@/components/AccountSettingsModal';

// ── Channel row — Stoat pill style ────────────────────────────────────────────
function ChannelItem({ channel, active, onSelect }: {
  channel: Channel; active: boolean; onSelect: () => void;
}) {
  const Icon = channel.type === 'voice' ? Mic : Hash;
  return (
    <div
      onClick={onSelect}
      className={`channel-item${active ? ' active' : ''}`}
    >
      <Icon className="channel-icon w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-sm truncate">{channel.name}</span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="sidebar-section-title">
      <span>{label}</span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ChannelSidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { activeChannel, setActiveChannel } = useUIStore();
  const { serverName, iconUrl, channels, isLoading } = useServerStore();

  const [dropdownOpen, setDropdownOpen]       = useState(false);
  const [showAvatarModal, setShowAvatarModal]   = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const isAdmin = user?.isAdmin ?? false;

  const textChannels  = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  return (
    <aside className="channel-sidebar flex flex-col h-full">

      {/* ── Server header ── */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors duration-150 rounded-lg"
        >
          {/* Server icon */}
          {isLoading ? (
            <div className="skeleton w-8 h-8 rounded-xl flex-shrink-0" />
          ) : iconUrl ? (
            <img src={iconUrl} alt={serverName} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
              {serverName.slice(0, 1).toUpperCase()}
            </div>
          )}

          {/* Server name */}
          {isLoading
            ? <div className="skeleton flex-1 h-4 rounded" />
            : <span className="font-semibold text-sm text-text-normal truncate flex-1 text-left">{serverName}</span>
          }
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

            {voiceChannels.length > 0 && (
              <>
                <div className="mt-4" />
                <SectionHeader label="Voice Channels" />
                {voiceChannels.map(ch => (
                  <ChannelItem key={ch.id} channel={ch} active={activeChannel === ch.id} onSelect={() => setActiveChannel(ch.id)} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* ── User footer ── */}
      <div className="px-2 py-2 flex items-center gap-2.5 flex-shrink-0">
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
        {/* Clickable name area → Account Settings */}
        <div
          className="flex flex-col min-w-0 flex-1 cursor-pointer rounded-lg px-1.5 py-1 hover:bg-white/6 transition-colors duration-150 group"
          onClick={() => setShowAccountModal(true)}
          title="Account Settings"
        >
          <span className="text-sm font-medium text-text-normal truncate group-hover:text-white transition-colors">{user?.displayName}</span>
          <span className="text-xs text-text-muted truncate">#{user?.username}</span>
        </div>
        <button
          onClick={() => setShowAccountModal(true)}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-normal hover:bg-white/6 transition-all duration-150 flex-shrink-0"
          title="Account Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showAvatarModal && (
        <AvatarUploadModal onClose={() => setShowAvatarModal(false)} />
      )}
      {showAccountModal && (
        <AccountSettingsModal onClose={() => setShowAccountModal(false)} />
      )}
    </aside>
  );
}
