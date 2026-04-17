import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useDMStore, type DMMessage, type DMConversation } from '@/store/useDMStore';
import { useUIStore } from '@/store/useUIStore';

// Re-use the same singleton socket from useSocket
let _socket: import('socket.io-client').Socket | null = null;
export function setDMSocket(s: import('socket.io-client').Socket | null) { _socket = s; }

export function useDMSocket() {
  const { token } = useAuthStore();
  const { addMessage, setTyping, updateConversationLastMessage, upsertConversation } = useDMStore();

  // Register DM socket listeners (called once from ChatPage alongside useSocket)
  useEffect(() => {
    if (!_socket) return;

    const onMessage = (msg: DMMessage) => {
      const { activeDmConversation } = useUIStore.getState();
      if (msg.conversationId === activeDmConversation) {
        addMessage(msg);
      }
    };

    const onConvUpdate = ({ conversationId, lastMessage }: { conversationId: string; lastMessage: DMMessage }) => {
      updateConversationLastMessage(conversationId, lastMessage);
    };

    const onTyping = ({ displayName, typing }: { displayName: string; typing: boolean }) => {
      setTyping(displayName, typing);
    };

    _socket.on('dm:message', onMessage);
    _socket.on('dm:conversation:update', onConvUpdate);
    _socket.on('dm:typing:update', onTyping);

    return () => {
      _socket?.off('dm:message', onMessage);
      _socket?.off('dm:conversation:update', onConvUpdate);
      _socket?.off('dm:typing:update', onTyping);
    };
  }, [token]);

  const joinDMRoom = useCallback((conversationId: string) => {
    _socket?.emit('dm:join', { conversationId });
  }, []);

  const sendDM = useCallback((conversationId: string, content: string) => {
    _socket?.emit('dm:send', { conversationId, content });
  }, []);

  const sendDMTyping = useCallback((conversationId: string, typing: boolean) => {
    _socket?.emit('dm:typing', { conversationId, typing });
  }, []);

  return { joinDMRoom, sendDM, sendDMTyping };
}
