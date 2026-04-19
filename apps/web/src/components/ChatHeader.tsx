import { Bell, Hash, Moon, Monitor, PanelLeft, Pin, Search, Sun, Users, X } from 'lucide-react';
import { useThemeStore }  from '../store/useThemeStore';
import { useUIStore }     from '../store/useUIStore';
import { useChatStore }   from '../store/useChatStore';
import { useDMStore }     from '../store/useDMStore';
import { useServerStore } from '../store/useServerStore';
import { LazyAvatar }        from './LazyAvatar';

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

  const activeDmConv = useDMStore(s =>
    s.conversations.find(c => c.id === activeDmConversation)
  );

  return (
    <div className="canvas-header">
      {/* Left: sidebar toggle + channel/DM identity */}
      <div className="flex items-center gap-2 min-w-0 flex-1">

        {/* Sidebar toggle — always visible so user can reopen it */}
        <button
          onClick={onToggleSidebar}
          className={`canvas-icon-btn flex-shrink-0 ${sidebarVisible ? 'active' : ''}`}
          title={sidebarVisible ? 'Hide channels' : 'Show channels'}
        >
          <PanelLeft className="w-5 h-5" />
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
                <span className="text-[14px] font-semibold text-text-normal truncate">
                  {activeDmConv?.partner?.displayName ?? 'Unknown'}
                </span>
                <span className="text-[12px] text-text-muted truncate">
                  @{activeDmConv?.partner?.username}
                </span>
              </div>
            </>
          ) : (
            <>
              <Hash className="w-[18px] h-[18px] text-text-muted flex-shrink-0" />
              <span className="text-[15px] font-semibold text-text-normal truncate">
                {channelName}
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-status-green live-dot' : 'bg-text-muted'}`} />
                <span className="text-[12px] text-text-muted">
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
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={onTogglePinned}
              className={`canvas-icon-btn ${showPinned ? 'active' : ''}`}
              title="Pinned messages"
            >
              <Pin className="w-5 h-5" />
            </button>
            <button
              onClick={onToggleSearch}
              className={`canvas-icon-btn ${showSearch ? 'active' : ''}`}
              title="Search messages"
            >
              <Search className="w-5 h-5" />
            </button>
          </>
        )}

        <button
          onClick={cycleTheme}
          className="canvas-icon-btn"
          title={`Theme: ${theme} — click to switch`}
        >
          {theme === 'dark'   ? <Moon    className="w-5 h-5" />
           : theme === 'light' ? <Sun     className="w-5 h-5" />
           :                     <Monitor className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleMembers}
          className={`canvas-icon-btn ${membersVisible ? 'active' : ''}`}
          title="Toggle members"
        >
          <Users className="w-5 h-5" />
        </button>

        {isDMOpen && (
          <button
            onClick={() => useUIStore.getState().setActiveDmConversation(null)}
            className="canvas-icon-btn ml-1"
            title="Close DM"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
