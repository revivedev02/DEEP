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
  const { joinDMRoom, sendDM, sendDMTyping, sendDMEdit } = useDMSocket();
  const { theme, cycleTheme } = useThemeStore();
  const { messages, isConnected } = useChatStore();

  const isDMOpen  = !!activeDmConversation;

  // Header panel states
  const [showSearch, setShowSearch]         = useState(false);
  const [isSearchClosing, setIsSearchClosing] = useState(false);
  const [showPinned, setShowPinned]         = useState(false);

  const closeSearch = useCallback(() => {
    setIsSearchClosing(true);
    setTimeout(() => { setShowSearch(false); setIsSearchClosing(false); }, 150);
  }, []);

  // For search: use DM messages when in DM, channel messages otherwise
  const dmMessages = useDMStore(s => s.messages);
  const searchMessages = isDMOpen
    ? dmMessages.map(m => ({
        ...m,
        channelId: m.conversationId,
        pinned: false,
        reactions: m.reactions ?? [],
        replyToId: m.replyToId ?? null,
        replyTo: null,
      }))
    : messages;

  // Reset search/pin whenever context switches
  useEffect(() => {
    setShowSearch(false);
    setShowPinned(false);
  }, [isDMOpen, activeChannel, activeDmConversation]);

  useValidateToken();
  const { loadOlderMessages } = useMessages();
  useServerData();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const isVoice   = activeChannelObj?.type === 'voice';
  const isText    = !isVoice && activeChannel !== '';
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

  const handleSendDM   = (content: string, replyToId?: string) => { if (activeDmConversation) sendDM(activeDmConversation, content, replyToId); };
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
                  <Hash className="w-6 h-6 text-text-muted flex-shrink-0" />
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
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setShowPinned(p => !p); closeSearch(); }}
                className={`canvas-icon-btn ${showPinned ? 'active' : ''}`}
                title="Pinned messages"
              >
                <Pin className="w-5 h-5" />
              </button>
              <button
                onClick={() => { if (showSearch) { closeSearch(); } else { setShowSearch(true); setShowPinned(false); } }}
                className={`canvas-icon-btn ${showSearch ? 'active' : ''}`}
                title="Search messages"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={cycleTheme}
                className="canvas-icon-btn"
                title={`Theme: ${theme} — click to switch`}
              >
                {theme === 'dark'  ? <Moon className="w-5 h-5" />
                 : theme === 'light' ? <Sun className="w-5 h-5" />
                 : <Monitor className="w-5 h-5" />}
              </button>
              <button
                onClick={toggleMembers}
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
        )}

        {/* ── Card + Members row ── */}
        <div style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0, overflow: 'hidden' }}>

          {/* Chat card — search overlay is scoped inside here */}
          <div className="chat-card" style={{ position: 'relative' }}>

            {/* ── Search bar — floats over the card only, doesn't affect layout ── */}
            {showSearch && showHeader && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 50,
                }}
                className={isSearchClosing ? 'animate-slide-up-out' : 'animate-slide-down'}
              >
                <SearchBar
                  messages={searchMessages as any}
                  currentUserId={user?.id ?? ''}
                  onClose={closeSearch}
                  onJump={scrollToMessage}
                />
              </div>
            )}

            <div className="main-content">
              {isDMOpen ? (
                <DMPane
                  conversationId={activeDmConversation!}
                  partner={activeDmConv?.partner ?? null}
                  onSend={handleSendDM}
                  onEdit={sendDMEdit}
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

          {/* Members panel — always mounted, width animates smoothly */}
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
  );
}
