import { Bell, Hash, Moon, Monitor, PanelLeft, Pin, Search, Sun, Users, Volume2, X } from 'lucide-react';
import { useThemeStore }  from '../store/useThemeStore';
import { useUIStore }     from '../store/useUIStore';
import { useChatStore }   from '../store/useChatStore';
import { useDMStore }     from '../store/useDMStore';
import { useServerStore } from '../store/useServerStore';
import { LazyAvatar }     from './LazyAvatar';

interface ChatHeaderProps {
  showHeader:      boolean;
  showSearch:      boolean;
  showPinned:      boolean;
  membersVisible:  boolean;
  sidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  onToggleSearch:  () => void;
  onTogglePinned:  () => void;
  onToggleMembers: () => void;
}

export default function ChatHeader({
  showHeader,
  showSearch,
  showPinned,
  membersVisible,
  sidebarVisible,
  onToggleSidebar,
  onToggleSearch,
  onTogglePinned,
  onToggleMembers,
}: ChatHeaderProps) {
  const { theme, cycleTheme }                   = useThemeStore();
  const { activeChannel, activeDmConversation } = useUIStore();
  const { isConnected }                         = useChatStore();
  const { channels }                            = useServerStore();

  const isDMOpen         = !!activeDmConversation;
  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const channelName      = activeChannelObj?.name ?? 'general';
  const isVoice          = activeChannelObj?.type === 'voice';

  const activeDmConv = useDMStore(s =>
    s.conversations.find(c => c.id === activeDmConversation)
  );

  return (
    <div className="canvas-header">
      {/* Left: sidebar toggle + channel/DM identity */}
      <div className="flex items-center gap-2 min-w-0 flex-1">

        <button
          onClick={onToggleSidebar}
          className={`canvas-icon-btn flex-shrink-0 ${sidebarVisible ? 'active' : ''}`}
          title={sidebarVisible ? 'Hide channels' : 'Show channels'}
        >
          <PanelLeft className="icon-lg" />
        </button>

        {showHeader && (
          isDMOpen ? (
            <>
              <LazyAvatar
                name={activeDmConv?.partner?.displayName ?? '?'}
                avatarUrl={activeDmConv?.partner?.avatarUrl}
                size={7}
              />
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-semibold text-text-normal truncate"
                      style={{ fontSize: 'var(--ui-md)' }}>
                  {activeDmConv?.partner?.displayName ?? 'Unknown'}
                </span>
                <span className="text-text-muted truncate"
                      style={{ fontSize: 'var(--ui-xs)' }}>
                  @{activeDmConv?.partner?.username}
                </span>
              </div>
            </>
          ) : isVoice ? (
            <>
              <Volume2 className="icon-md text-text-muted" />
              <span className="font-semibold text-text-normal truncate"
                    style={{ fontSize: 'var(--ui-md)' }}>
                {channelName}
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-status-green live-dot" />
                <span className="text-text-muted" style={{ fontSize: 'var(--ui-xs)' }}>voice</span>
              </div>
            </>
          ) : (
            <>
              <Hash className="icon-md text-text-muted" />
              <span className="font-semibold text-text-normal truncate"
                    style={{ fontSize: 'var(--ui-md)' }}>
                {channelName}
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-status-green live-dot' : 'bg-text-muted'}`} />
                <span className="text-text-muted" style={{ fontSize: 'var(--ui-xs)' }}>
                  {isConnected ? 'live' : 'offline'}
                </span>
              </div>
            </>
          )
        )}
      </div>

      {/* Right: action icons */}
      <div className="flex items-center gap-0.5">
        {showHeader && (
          <>
            <button className="canvas-icon-btn" title="Notifications (coming soon)">
              <Bell className="icon-lg" />
            </button>
            <button
              onClick={onTogglePinned}
              className={`canvas-icon-btn ${showPinned ? 'active' : ''}`}
              title="Pinned messages"
            >
              <Pin className="icon-lg" />
            </button>
            <button
              onClick={onToggleSearch}
              className={`canvas-icon-btn ${showSearch ? 'active' : ''}`}
              title="Search messages"
            >
              <Search className="icon-lg" />
            </button>
          </>
        )}

        <button
          onClick={cycleTheme}
          className="canvas-icon-btn"
          title={`Theme: ${theme} — click to switch`}
        >
          {theme === 'dark'   ? <Moon    className="icon-lg" />
           : theme === 'light' ? <Sun     className="icon-lg" />
           :                     <Monitor className="icon-lg" />}
        </button>

        <button
          onClick={onToggleMembers}
          className={`canvas-icon-btn ${membersVisible ? 'active' : ''}`}
          title="Toggle members"
        >
          <Users className="icon-lg" />
        </button>

        {isDMOpen && (
          <button
            onClick={() => useUIStore.getState().setActiveDmConversation(null)}
            className="canvas-icon-btn ml-1"
            title="Close DM"
          >
            <X className="icon-lg" />
          </button>
        )}
      </div>
    </div>
  );
}
