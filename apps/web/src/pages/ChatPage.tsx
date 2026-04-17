import { useEffect, useCallback, useState } from 'react';
import {
  Hash, Users, Bell, Pin, Search, Moon, Sun, Monitor, X, MessageSquare,
} from 'lucide-react';
import ChannelSidebar from '@/components/ChannelSidebar';
import MessagePane from '@/components/MessagePane';
import VoicePane from '@/components/VoicePane';
import MembersPanel from '@/components/MembersPanel';
import DMPane from '@/components/DMPane';
import WelcomePane from '@/components/WelcomePane';
import { SearchBar } from '@/components/SearchBar';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore } from '@/store/useServerStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useDMStore } from '@/store/useDMStore';
import { useSocket } from '@/hooks/useSocket';
import { useMessages } from '@/hooks/useMessages';
import { useValidateToken } from '@/hooks/useValidateToken';
import { useServerData } from '@/hooks/useServerData';
import { useDMSocket } from '@/hooks/useDMSocket';
import { useThemeStore } from '@/store/useThemeStore';
import { LazyAvatar } from '@/components/LazyAvatar';
import { scrollToMessage } from '@/components/messageUtils';

type MobileTab = 'channels' | 'chat' | 'members';

export default function ChatPage() {
  const { activeChannel, showMembers, toggleMembers, activeDmConversation } = useUIStore();
  const { channels } = useServerStore();
  const { user, token } = useAuthStore();
  const { sendMessage, sendTyping, joinChannel } = useSocket();
  const { joinDMRoom, sendDM, sendDMTyping } = useDMSocket();
  const { theme, cycleTheme } = useThemeStore();
  const { messages, isConnected } = useChatStore();

  // Header state
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<MobileTab>('channels');

  useValidateToken();
  const { loadOlderMessages } = useMessages();
  useServerData();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const isVoice   = activeChannelObj?.type === 'voice';
  const isText    = !isVoice && activeChannel !== '';
  const isDMOpen  = !!activeDmConversation;
  const showHeader = isText || isDMOpen;
  const membersVisible = showMembers && showHeader;

  const activeDmConv = useDMStore(s => s.conversations.find(c => c.id === activeDmConversation));
  const channelName  = activeChannelObj?.name ?? 'general';

  // Auto-switch to chat tab when channel or DM selected (mobile)
  useEffect(() => {
    if (activeChannel || activeDmConversation) setMobileTab('chat');
  }, [activeChannel, activeDmConversation]);

  // Join channel socket room
  useEffect(() => {
    if (!isDMOpen && activeChannel) joinChannel(activeChannel);
  }, [activeChannel, isDMOpen]);

  // DM conversation load
  useEffect(() => {
    if (!isDMOpen || !activeDmConversation || !token) return;
    joinDMRoom(activeDmConversation);
    useDMStore.getState().setLoading(true);
    fetch(`/api/dm/${activeDmConversation}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(msgs => { if (Array.isArray(msgs)) useDMStore.getState().setMessages(msgs); })
      .catch(() => useDMStore.getState().setLoading(false));
  }, [activeDmConversation]);

  const handleSendMessage = (content: string) => {
    if (!user || !activeChannel) return;
    const replyingTo = useChatStore.getState().replyingTo;
    sendMessage(content, activeChannel, replyingTo?.id);
    useChatStore.getState().setReplyingTo(null);
  };

  const handleSendDM   = (content: string) => { if (activeDmConversation) sendDM(activeDmConversation, content); };
  const handleDMTyping = (typing: boolean) => { if (activeDmConversation) sendDMTyping(activeDmConversation, typing); };

  const handleLoadOlderDM = useCallback(() => {
    if (!token || !activeDmConversation) return;
    const { messages: dms, isLoadingOlder, hasMore } = useDMStore.getState();
    if (isLoadingOlder || !hasMore) return;
    const oldest = dms[0];
    if (!oldest) return;
    useDMStore.getState().setLoadingOlder(true);
    fetch(`/api/dm/${activeDmConversation}/messages?before=${oldest.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(msgs => { if (Array.isArray(msgs)) useDMStore.getState().prependMessages(msgs); })
      .catch(() => useDMStore.getState().setLoadingOlder(false));
  }, [token, activeDmConversation]);

  // ── Shared header bar ──────────────────────────────────────────────────────
  const headerBar = showHeader && (
    <div className="canvas-header">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isDMOpen ? (
          <>
            <LazyAvatar
              name={activeDmConv?.partner.displayName ?? '?'}
              avatarUrl={activeDmConv?.partner.avatarUrl}
              size={7}
            />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold text-text-normal truncate">
                {activeDmConv?.partner.displayName ?? 'Unknown'}
              </span>
              <span className="text-xs text-text-muted truncate">
                @{activeDmConv?.partner.username}
              </span>
            </div>
          </>
        ) : (
          <>
            <Hash className="w-4 h-4 text-text-muted flex-shrink-0" />
            <span className="text-sm font-semibold text-text-normal truncate">{channelName}</span>
            <div className="hidden sm:flex items-center gap-1.5 ml-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-status-green' : 'bg-text-muted'}`} />
              <span className="text-xs text-text-muted">{isConnected ? 'live' : 'offline'}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button className="canvas-icon-btn" title="Notifications (coming soon)">
          <Bell className="w-4 h-4" />
        </button>
        {!isDMOpen && (
          <button
            onClick={() => { setShowPinned(p => !p); setShowSearch(false); }}
            className={`canvas-icon-btn ${showPinned ? 'active' : ''}`}
            title="Pinned messages"
          >
            <Pin className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => { setShowSearch(s => !s); setShowPinned(false); }}
          className={`canvas-icon-btn ${showSearch ? 'active' : ''}`}
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>
        <button onClick={cycleTheme} className="canvas-icon-btn" title="Theme">
          {theme === 'dark' ? <Moon className="w-4 h-4" />
           : theme === 'light' ? <Sun className="w-4 h-4" />
           : <Monitor className="w-4 h-4" />}
        </button>
        {/* Members toggle — desktop only (mobile uses tab bar) */}
        <button
          onClick={toggleMembers}
          className={`canvas-icon-btn hidden-mobile ${membersVisible ? 'active' : ''}`}
          title="Toggle members"
        >
          <Users className="w-4 h-4" />
        </button>
        {isDMOpen && (
          <button
            onClick={() => useUIStore.getState().setActiveDmConversation(null)}
            className="canvas-icon-btn ml-1"
            title="Close DM"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  // ── Chat content ───────────────────────────────────────────────────────────
  const chatContent = (
    <div className="chat-card">
      <div className="main-content">
        {isDMOpen ? (
          <DMPane
            conversationId={activeDmConversation!}
            partner={activeDmConv?.partner ?? null}
            onSend={handleSendDM}
            onTyping={handleDMTyping}
            onLoadOlder={handleLoadOlderDM}
            showPinnedPanel={showPinned}
            onClosePinned={() => setShowPinned(false)}
          />
        ) : activeChannel === '' ? (
          <WelcomePane />
        ) : isVoice ? (
          <VoicePane />
        ) : (
          <MessagePane
            onSendMessage={handleSendMessage}
            onTyping={sendTyping}
            onLoadOlder={loadOlderMessages}
            showPinnedPanel={showPinned}
            onClosePinned={() => setShowPinned(false)}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── DESKTOP LAYOUT ─────────────────────────────────────────────────── */}
      <div className="layout-root desktop-layout">
        <ChannelSidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          {headerBar}
          {showSearch && showHeader && (
            <div style={{ borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              <SearchBar
                messages={messages as any}
                currentUserId={user?.id ?? ''}
                onClose={() => setShowSearch(false)}
                onJump={scrollToMessage}
              />
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            {chatContent}
            <div
              style={{
                width: membersVisible ? 220 : 0,
                flexShrink: 0,
                overflow: 'hidden',
                transition: 'width 220ms cubic-bezier(0.4,0,0.2,1), opacity 180ms ease',
                opacity: membersVisible ? 1 : 0,
              }}
            >
              <MembersPanel />
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE LAYOUT ──────────────────────────────────────────────────── */}
      <div className="mobile-layout">
        {/* Header — always on top */}
        {showHeader && (
          <div className="mobile-header">
            {headerBar}
            {showSearch && (
              <SearchBar
                messages={messages as any}
                currentUserId={user?.id ?? ''}
                onClose={() => setShowSearch(false)}
                onJump={scrollToMessage}
              />
            )}
          </div>
        )}

        {/* Panel content */}
        <div className="mobile-panel">
          {mobileTab === 'channels' && (
            <div className="mobile-panel-inner">
              <ChannelSidebar />
            </div>
          )}
          {mobileTab === 'chat' && (
            <div className="mobile-panel-inner">
              {chatContent}
            </div>
          )}
          {mobileTab === 'members' && (
            <div className="mobile-panel-inner">
              <MembersPanel />
            </div>
          )}
        </div>

        {/* Bottom tab bar */}
        <nav className="mobile-tab-bar">
          <button
            className={`mobile-tab ${mobileTab === 'channels' ? 'active' : ''}`}
            onClick={() => setMobileTab('channels')}
          >
            <Hash className="w-5 h-5" />
            <span>Channels</span>
          </button>
          <button
            className={`mobile-tab ${mobileTab === 'chat' ? 'active' : ''}`}
            onClick={() => setMobileTab('chat')}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Chat</span>
          </button>
          <button
            className={`mobile-tab ${mobileTab === 'members' ? 'active' : ''}`}
            onClick={() => setMobileTab('members')}
          >
            <Users className="w-5 h-5" />
            <span>Members</span>
          </button>
        </nav>
      </div>
    </>
  );
}
