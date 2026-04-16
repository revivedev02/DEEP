import ChannelSidebar from '@/components/ChannelSidebar';
import MessagePane from '@/components/MessagePane';
import VoicePane from '@/components/VoicePane';
import MembersPanel from '@/components/MembersPanel';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore } from '@/store/useServerStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/hooks/useSocket';
import { useMessages } from '@/hooks/useMessages';
import { useValidateToken } from '@/hooks/useValidateToken';
import { useServerData } from '@/hooks/useServerData';

export default function ChatPage() {
  const { activeChannel, showMembers } = useUIStore();
  const { channels } = useServerStore();
  const { user } = useAuthStore();
  const { sendMessage } = useSocket();

  useValidateToken();  // clears stale/demo tokens
  useMessages();       // fetch message history
  useServerData();     // fetch channels + server name

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const isVoice = activeChannelObj?.type === 'voice';
  const isText  = !isVoice && activeChannel !== '';

  const handleSendMessage = (content: string) => {
    if (!user) return;
    sendMessage(content);
  };

  return (
    <div className="layout-root">
      <ChannelSidebar />

      <main className="main-content">
        {activeChannel === '' ? (
          // Loading state while channels fetch
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Connecting…
          </div>
        ) : isVoice ? (
          <VoicePane />
        ) : (
          <MessagePane onSendMessage={handleSendMessage} />
        )}
      </main>

      {showMembers && isText && (
        <MembersPanel />
      )}
    </div>
  );
}
