import { useEffect, useCallback, useState } from 'react';
import {
  Hash, Users, Bell, Pin, Search, Moon, Sun, Monitor, X,
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

export default function ChatPage() {
  const { activeChannel, showMembers, toggleMembers, activeDmConversation } = useUIStore();
  const { channels } = useServerStore();
  const { user, token } = useAuthStore();
  const { sendMessage, sendTyping, joinChannel } = useSocket();
  const { joinDMRoom, sendDM, sendDMTyping } = useDMSocket();
  const { theme, cycleTheme } = useThemeStore();
  const { messages, isConnected } = useChatStore();

  // Header panel states (lifted to canvas level)
  const [showSearch, setShowSearch]   = useState(false);
  const [showPinned, setShowPinned]   = useState(false);

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

  // Join channel socket room
  useEffect(() => {
    if (!isDMOpen && activeChannel) joinChannel(activeChannel);
  }, [activeChannel, isDMOpen]);

  // When a DM conversation is selected
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

  return (
    <div className="layout-root">

      {/* ── Channel Sidebar — on canvas ── */}
      <ChannelSidebar />

      {/* ── Center column: header bar (canvas) + card + search ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>

        {/* ── Canvas-level header bar — only when channel/DM is open ── */}
        {showHeader && (
          <div className="canvas-header">
            {/* Left: channel/DM identity */}
            <div className="flex items-center gap-2 min-w-0">
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
                  <Hash className="w-5 h-5 text-text-muted flex-shrink-0" />
                  <span className="text-base font-semibold text-text-normal truncate">{channelName}</span>
                  {/* Live indicator */}
                  <div className="flex items-center gap-1.5 ml-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-status-green' : 'bg-text-muted'}`} />
                    <span className="text-xs text-text-muted">{isConnected ? 'live' : 'offline'}</span>
                  </div>
                </>
              )}
            </div>

            {/* Right: action icons */}
            <div className="flex items-center gap-0.5 ml-auto">
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
                title="Search messages"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={cycleTheme}
                className="canvas-icon-btn"
                title={`Theme: ${theme} — click to switch`}
              >
                {theme === 'dark'  ? <Moon className="w-4 h-4" />
                 : theme === 'light' ? <Sun className="w-4 h-4" />
                 : <Monitor className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleMembers}
                className={`canvas-icon-btn ${membersVisible ? 'active' : ''}`}
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
        )}

        {/* ── Search bar (on canvas, below header) ── */}
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

        {/* ── Card + Members row ── */}
        <div style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0, overflow: 'hidden' }}>

          {/* Chat card */}
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

          {/* Members panel — on canvas, same family as sidebar */}
          {membersVisible && (
            <div style={{ width: 220, flexShrink: 0, overflow: 'hidden', animation: 'members-slide-in 180ms ease both' }}>
              <MembersPanel />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
