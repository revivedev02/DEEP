import { useEffect, useCallback } from 'react';
import ChannelSidebar from '@/components/ChannelSidebar';
import MessagePane from '@/components/MessagePane';
import VoicePane from '@/components/VoicePane';
import MembersPanel from '@/components/MembersPanel';
import DMPane from '@/components/DMPane';
import WelcomePane from '@/components/WelcomePane';
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

export default function ChatPage() {
  const { activeChannel, showMembers, activeDmConversation } = useUIStore();
  const { channels } = useServerStore();
  const { user, token } = useAuthStore();
  const { sendMessage, sendTyping, joinChannel } = useSocket();
  const { joinDMRoom, sendDM, sendDMTyping } = useDMSocket();

  useValidateToken();
  const { loadOlderMessages } = useMessages();
  useServerData();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const isVoice   = activeChannelObj?.type === 'voice';
  const isText    = !isVoice && activeChannel !== '';
  const isDMOpen  = !!activeDmConversation;

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
    const { messages, isLoadingOlder, hasMore } = useDMStore.getState();
    if (isLoadingOlder || !hasMore) return;
    const oldest = messages[0];
    if (!oldest) return;
    useDMStore.getState().setLoadingOlder(true);
    fetch(`/api/dm/${activeDmConversation}/messages?before=${oldest.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(msgs => { if (Array.isArray(msgs)) useDMStore.getState().prependMessages(msgs); })
      .catch(() => useDMStore.getState().setLoadingOlder(false));
  }, [token, activeDmConversation]);

  const activeDmConv = useDMStore(s => s.conversations.find(c => c.id === activeDmConversation));

  // Members panel visible when: text channel open OR DM open AND user toggled it
  const membersVisible = showMembers && (isText || isDMOpen);

  return (
    <div className="layout-root">
      {/* Sidebar — floats on canvas */}
      <ChannelSidebar />

      {/* Chat card — floating elevated box */}
      <div className="chat-card">
        <div className="main-content">
          {isDMOpen ? (
            <DMPane
              conversationId={activeDmConversation!}
              partner={activeDmConv?.partner ?? null}
              onClose={() => useUIStore.getState().setActiveDmConversation(null)}
              onSend={handleSendDM}
              onTyping={handleDMTyping}
              onLoadOlder={handleLoadOlderDM}
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
            />
          )}
        </div>

        {/* Members panel — inside the card but no visual border */}
        {membersVisible && (
          <div
            style={{
              width: 220,
              borderLeft: '1px solid rgba(var(--separator-rgb) / 0.10)',
              flexShrink: 0,
              overflow: 'hidden',
              animation: 'members-slide-in 180ms ease both',
            }}
          >
            <MembersPanel />
          </div>
        )}
      </div>
    </div>
  );
}
