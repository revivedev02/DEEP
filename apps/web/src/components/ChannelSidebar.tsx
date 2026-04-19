import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Shield, LogOut, Hash, Mic, MicOff, Headphones, Settings } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore, type Channel } from '@/store/useServerStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { SkChannelSidebar } from '@/components/Skeleton';
import { LazyAvatar } from '@/components/LazyAvatar';
import AccountSettingsModal from '@/components/AccountSettingsModal';
import VoiceBar from '@/components/VoiceBar';

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
  const voiceChannelId    = useVoiceStore(s => s.channelId);
  const voiceParticipants = useVoiceStore(s => s.participants);

  const [dropdownOpen, setDropdownOpen]       = useState(false);
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
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-bg-hover transition-colors duration-150 rounded-lg"
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
            : <span className="font-semibold text-text-normal truncate flex-1 text-left"
                    style={{ fontSize: 'var(--ui-md)' }}>{serverName}</span>
          }
          <ChevronDown className={`icon-lg text-text-muted flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
            <div className="dropdown-menu absolute top-full left-2 right-2 z-40 animate-fade-in">
              {isAdmin && (
                <>
                  <button className="dropdown-item" onClick={() => { navigate('/admin'); setDropdownOpen(false); }}>
                    <Shield className="icon-sm" /> Admin Panel
                  </button>
                  <div className="dropdown-divider" />
                </>
              )}
              <button className="dropdown-item text-status-red" onClick={() => { logout(); navigate('/login'); }}>
                <LogOut className="icon-sm" /> Log Out
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
                {voiceChannels.map(ch => {
                  const isThisChannel = voiceChannelId === ch.id;
                  const participants = isThisChannel ? voiceParticipants : [];
                  return (
                    <div key={ch.id}>
                      <ChannelItem channel={ch} active={activeChannel === ch.id} onSelect={() => setActiveChannel(ch.id)} />
                      {participants.map(p => (
                        <div
                          key={p.userId}
                          className={`voice-channel-participant ${p.isSpeaking && !p.isMuted ? 'is-speaking' : ''}`}
                        >
                          <LazyAvatar name={p.displayName} avatarUrl={p.avatarUrl} size={5} />
                          <span className="truncate flex-1">{p.displayName}</span>
                          {p.isMuted
                            ? <MicOff className="icon-sm text-red-400" />
                            : <Mic    className="icon-sm text-text-muted" />}
                          <Headphones className="icon-sm text-text-muted opacity-50" />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Voice bar — persistent when connected ── */}
      <VoiceBar />

      {/* ── User footer — clicking anywhere opens Account Settings ── */}
      <div
        className="px-2 py-2 flex items-center gap-2.5 flex-shrink-0 cursor-pointer rounded-xl
                   hover:bg-bg-hover transition-colors duration-150 group mx-1"
        onClick={() => setShowAccountModal(true)}
        title="Account Settings"
      >
        {/* Avatar — display only, no click */}
        <div className="flex-shrink-0">
          <LazyAvatar name={user?.displayName ?? '?'} avatarUrl={user?.avatarUrl} size={8} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-ui-md font-medium text-text-normal truncate transition-colors">
            {user?.displayName}
          </span>
          <span className="text-ui-sm text-text-muted truncate">#{user?.username}</span>
        </div>
        <Settings className="icon-md text-text-muted group-hover:text-text-normal transition-colors flex-shrink-0" />
      </div>

      {showAccountModal && (
        <AccountSettingsModal onClose={() => setShowAccountModal(false)} />
      )}
    </aside>
  );
}
