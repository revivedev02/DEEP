import { useEffect, useCallback } from 'react';
import ChannelSidebar from '@/components/ChannelSidebar';
import MessagePane from '@/components/MessagePane';
import VoicePane from '@/components/VoicePane';
import MembersPanel from '@/components/MembersPanel';
import DMPane from '@/components/DMPane';
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
  const { activeChannel, showMembers, sidebarMode, activeDmConversation, setActiveDmConversation } = useUIStore();
  const { channels } = useServerStore();
  const { user, token } = useAuthStore();
  const { sendMessage, sendTyping, joinChannel } = useSocket();
  const { joinDMRoom, sendDM, sendDMTyping } = useDMSocket();

  useValidateToken();
  const { loadOlderMessages } = useMessages();
  useServerData();

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const isVoice = activeChannelObj?.type === 'voice';
  const isText  = !isVoice && activeChannel !== '';
  const isDMMode = sidebarMode === 'dms';

  // Join channel socket room on switch
  useEffect(() => {
    if (!isDMMode && activeChannel) joinChannel(activeChannel);
  }, [activeChannel, isDMMode]);

  // Join DM room on switch
  useEffect(() => {
    if (isDMMode && activeDmConversation) {
      joinDMRoom(activeDmConversation);
      // Fetch DM messages
      if (token) {
        useDMStore.getState().setLoading(true);
        fetch(`/api/dm/${activeDmConversation}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(msgs => { if (Array.isArray(msgs)) useDMStore.getState().setMessages(msgs); })
          .catch(() => useDMStore.getState().setLoading(false));
      }
    }
  }, [activeDmConversation, isDMMode]);

  // Channel message handlers
  const handleSendMessage = (content: string) => {
    if (!user || !activeChannel) return;
    const replyingTo = useChatStore.getState().replyingTo;
    sendMessage(content, activeChannel, replyingTo?.id);
    useChatStore.getState().setReplyingTo(null);
  };

  // DM message handlers
  const handleSendDM = (content: string) => {
    if (!activeDmConversation) return;
    sendDM(activeDmConversation, content);
  };

  const handleDMTyping = (typing: boolean) => {
    if (!activeDmConversation) return;
    sendDMTyping(activeDmConversation, typing);
  };

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

  // Get the active DM conversation's partner from the DM store
  const activeDmConv = useDMStore.getState().conversations.find(c => c.id === activeDmConversation);

  return (
    <div className="layout-root">
      <ChannelSidebar />

      <main className="main-content">
        {isDMMode ? (
          activeDmConversation ? (
            <DMPane
              conversationId={activeDmConversation}
              partner={activeDmConv?.partner ?? null}
              onClose={() => setActiveDmConversation(null)}
              onSend={handleSendDM}
              onTyping={handleDMTyping}
              onLoadOlder={handleLoadOlderDM}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3 select-none">
              <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">Select a conversation or start a new DM</p>
            </div>
          )
        ) : activeChannel === '' ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Connecting…
          </div>
        ) : isVoice ? (
          <VoicePane />
        ) : (
          <MessagePane onSendMessage={handleSendMessage} onTyping={sendTyping} onLoadOlder={loadOlderMessages} />
        )}
      </main>

      {/* Members panel — hidden in DM mode */}
      <div
        className="w-px flex-shrink-0 bg-separator transition-opacity duration-200"
        style={{ opacity: !isDMMode && showMembers && isText ? 0.5 : 0 }}
      />
      <div
        className="flex-shrink-0 transition-all duration-200 ease-in-out overflow-hidden"
        style={{ width: !isDMMode && showMembers && isText ? 240 : 0, opacity: !isDMMode && showMembers && isText ? 1 : 0 }}
      >
        <MembersPanel />
      </div>
    </div>
  );
}
