import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import ChatHeader from '@/components/ChatHeader';
import ChannelSidebar from '@/components/ChannelSidebar';
import MessagePane from '@/components/MessagePane';
import MembersPanel from '@/components/MembersPanel';
import DMPane from '@/components/DMPane';
import WelcomePane from '@/components/WelcomePane';
import { ProfileCard } from '@/components/ProfileCard';
// Lazy-loaded — only bundled/evaluated when first rendered
const VoicePane = lazy(() => import('@/components/VoicePane'));
const SearchBar = lazy(() =>
  import('@/components/SearchBar').then(m => ({ default: m.SearchBar }))
);
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
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { useVoiceStore }   from '@/store/useVoiceStore';
import { scrollToMessage } from '@/components/messageUtils';
import type { UploadedMedia } from '@/lib/uploadMedia';

export default function ChatPage() {
  const { activeChannel, showMembers, toggleMembers, activeDmConversation, showChannelSidebar, toggleChannelSidebar } = useUIStore();
  const { channels } = useServerStore();
  const { user, token } = useAuthStore();
  const { sendMessage, sendTyping, joinChannel } = useSocket();
  const { joinDMRoom, sendDM, sendDMTyping, sendDMEdit } = useDMSocket();
  const { messages } = useChatStore();

  const isDMOpen  = !!activeDmConversation;
  const conversations = useDMStore(s => s.conversations);
  const activeDmConv  = conversations.find(c => c.id === activeDmConversation);

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
  const showHeader = isText || isDMOpen || isVoice;
  const membersVisible = showMembers; // always controllable, even from welcome screen

  // Voice channel hook — auto-joins on voice channel select
  const { joinChannel: joinVoice, leaveChannel: leaveVoice } = useVoiceChannel();

  // Join channel socket room (for chat messages)
  useEffect(() => {
    if (!isDMOpen && activeChannel) joinChannel(activeChannel);
  }, [activeChannel, isDMOpen]);

  // Auto-join voice channel when selected; leave if switching away from voice
  const voiceChannelId = useVoiceStore(s => s.channelId);
  useEffect(() => {
    if (isVoice && activeChannelObj) {
      joinVoice(activeChannelObj.id, activeChannelObj.name);
    } else if (!isVoice && voiceChannelId) {
      leaveVoice();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoice, activeChannelObj?.id]);

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

  const handleSendMessage = (content: string, media?: UploadedMedia) => {
    if (!user || !activeChannel) return;
    const replyingTo = useChatStore.getState().replyingTo;
    sendMessage(content, activeChannel, replyingTo?.id, media?.url, media?.type);
    useChatStore.getState().setReplyingTo(null);
  };

  const handleSendDM   = (content: string, media?: UploadedMedia, replyToId?: string) => {
    if (activeDmConversation) sendDM(activeDmConversation, content, replyToId, media?.url, media?.type);
  };
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
    <>
      <div className="layout-root">

      {/* ── Channel Sidebar — animated width, smooth collapse ── */}
      <div
        style={{
          width: showChannelSidebar ? 240 : 0,
          minWidth: 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <ChannelSidebar />
      </div>

      {/* ── Center column: [chat column + members panel] side by side ── */}
      <div style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0, overflow: 'hidden' }}>

        {/* Chat column: header + card stacked — header width = card width ✅ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>

          <ChatHeader
            showHeader={showHeader}
            showSearch={showSearch}
            showPinned={showPinned}
            membersVisible={membersVisible}
            sidebarVisible={showChannelSidebar}
            onToggleSidebar={toggleChannelSidebar}
            onToggleSearch={() => { if (showSearch) { closeSearch(); } else { setShowSearch(true); setShowPinned(false); } }}
            onTogglePinned={() => { setShowPinned(p => !p); closeSearch(); }}
            onToggleMembers={toggleMembers}
          />

          {/* Chat card — search overlay is scoped inside here */}
          <div className="chat-card" style={{ position: 'relative' }}>

            {/* Search bar — floats over the card only. Lazily loaded on first open */}
            {showSearch && showHeader && (
              <div
                style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 }}
                className={isSearchClosing ? 'animate-slide-up-out' : 'animate-slide-down'}
              >
                <Suspense fallback={null}>
                  <SearchBar
                    messages={searchMessages as any}
                    currentUserId={user?.id ?? ''}
                    onClose={closeSearch}
                    onJump={scrollToMessage}
                  />
                </Suspense>
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
                <Suspense fallback={<div className="flex-1" />}>
                  <VoicePane channelId={activeChannel} channelName={activeChannelObj?.name ?? ''} />
                </Suspense>
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

        </div>{/* end chat column */}

        {/* Members panel — sibling to chat column, NOT to card */}
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

    {/* Profile card — fixed overlay, renders outside layout flow */}
    <ProfileCard />
    </>
  );
}
