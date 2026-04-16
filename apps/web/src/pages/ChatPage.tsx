import ServerRail from '@/components/ServerRail';
import ChannelSidebar from '@/components/ChannelSidebar';
import MessagePane from '@/components/MessagePane';
import VoicePane from '@/components/VoicePane';
import MembersPanel from '@/components/MembersPanel';
import { useUIStore } from '@/store/useUIStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/hooks/useSocket';
import { useMessages } from '@/hooks/useMessages';
import { useValidateToken } from '@/hooks/useValidateToken';

export default function ChatPage() {
  const { activeChannel, showMembers } = useUIStore();
  const { user } = useAuthStore();
  const { sendMessage } = useSocket();
  useValidateToken(); // clears stale/demo tokens automatically
  useMessages();     // fetch history from real API on mount

  const handleSendMessage = (content: string) => {
    if (!user) return;
    // Just emit — server saves, broadcasts message:new back to all clients including sender
    sendMessage(content);
  };

  return (
    <div className="layout-root">
      <ChannelSidebar />

      <main className="main-content">
        {activeChannel === 'general' ? (
          <MessagePane onSendMessage={handleSendMessage} />
        ) : (
          <VoicePane />
        )}
      </main>

      {showMembers && activeChannel === 'general' && (
        <MembersPanel />
      )}
    </div>
  );
}
