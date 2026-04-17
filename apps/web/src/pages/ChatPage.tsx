import { useEffect } from 'react';
import ChannelSidebar from '@/components/ChannelSidebar';
import MessagePane from '@/components/MessagePane';
import VoicePane from '@/components/VoicePane';
import MembersPanel from '@/components/MembersPanel';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore } from '@/store/useServerStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useSocket } from '@/hooks/useSocket';
import { useMessages } from '@/hooks/useMessages';
import { useValidateToken } from '@/hooks/useValidateToken';
import { useServerData } from '@/hooks/useServerData';

export default function ChatPage() {
  const { activeChannel, showMembers } = useUIStore();
  const { channels } = useServerStore();
  const { user } = useAuthStore();
  const { sendMessage, sendTyping, joinChannel } = useSocket();

  useValidateToken();  // clears stale/demo tokens
  const { loadOlderMessages } = useMessages(); // fetch messages + infinite scroll
  useServerData();     // fetch channels + server name

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const isVoice = activeChannelObj?.type === 'voice';
  const isText  = !isVoice && activeChannel !== '';

  // Join the channel room on the socket whenever the active channel changes
  useEffect(() => {
    if (activeChannel) joinChannel(activeChannel);
  }, [activeChannel]);

  const handleSendMessage = (content: string) => {
    if (!user || !activeChannel) return;
    const replyingTo = useChatStore.getState().replyingTo;
    sendMessage(content, activeChannel, replyingTo?.id);
    useChatStore.getState().setReplyingTo(null);
  };

  return (
    <div className="layout-root">
      <ChannelSidebar />

      <main className="main-content">
        {activeChannel === '' ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Connecting…
          </div>
        ) : isVoice ? (
          <VoicePane />
        ) : (
          <MessagePane onSendMessage={handleSendMessage} onTyping={sendTyping} onLoadOlder={loadOlderMessages} />
        )}
      </main>

      {/* Thin separator line */}
      <div
        className="w-px flex-shrink-0 bg-separator transition-opacity duration-200"
        style={{ opacity: showMembers && isText ? 0.5 : 0 }}
      />
      {/* Members slide panel */}
      <div
        className="flex-shrink-0 transition-all duration-200 ease-in-out overflow-hidden"
        style={{ width: showMembers && isText ? 240 : 0, opacity: showMembers && isText ? 1 : 0 }}
      >
        <MembersPanel />
      </div>
    </div>
  );
}
