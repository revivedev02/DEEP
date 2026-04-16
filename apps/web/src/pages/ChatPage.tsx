import ServerRail from '@/components/ServerRail';
import ChannelSidebar from '@/components/ChannelSidebar';
import MessagePane from '@/components/MessagePane';
import VoicePane from '@/components/VoicePane';
import MembersPanel from '@/components/MembersPanel';
import { useUIStore } from '@/store/useUIStore';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/hooks/useSocket';
import { useMessages } from '@/hooks/useMessages';
import { useValidateToken } from '@/hooks/useValidateToken';

export default function ChatPage() {
  const { activeChannel, showMembers } = useUIStore();
  const { addMessage } = useChatStore();
  const { user } = useAuthStore();
  const { sendMessage } = useSocket();
  useValidateToken(); // clears stale/demo tokens automatically
  useMessages();     // fetch history from real API on mount

  const handleSendMessage = (content: string) => {
    if (!user) return;

    // Optimistic UI — add locally, server will broadcast back to others
    addMessage({
      id:        `optimistic-${Date.now()}`,
      content,
      userId:    user.id,
      channelId: 'text-main',
      createdAt: new Date().toISOString(),
      user: {
        id:          user.id,
        displayName: user.displayName,
        username:    user.username,
        avatarUrl:   user.avatarUrl,
        isAdmin:     user.isAdmin,
      },
    });

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
