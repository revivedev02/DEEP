import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useDMStore, type DMMessage } from '@/store/useDMStore';
import { useUIStore } from '@/store/useUIStore';

// Singleton socket shared from useSocket
let _socket: import('socket.io-client').Socket | null = null;
export function setDMSocket(s: import('socket.io-client').Socket | null) { _socket = s; }

export function useDMSocket() {
  const { token } = useAuthStore();
  const { addMessage, setTyping, updateConversationLastMessage } = useDMStore();

  useEffect(() => {
    if (!_socket) return;

    // New message — only add if it belongs to the active conversation
    const onMessage = (msg: DMMessage) => {
      if (msg.conversationId === useUIStore.getState().activeDmConversation) {
        addMessage(msg);
      }
    };

    // Update conversation list (last message preview)
    const onConvUpdate = ({ conversationId, lastMessage }: { conversationId: string; lastMessage: DMMessage }) => {
      updateConversationLastMessage(conversationId, lastMessage);
    };

    // Typing indicator
    const onTyping = ({ displayName, typing }: { displayName: string; typing: boolean }) => {
      setTyping(displayName, typing);
    };

    // Real-time edit
    const onEdited = ({ messageId, content, editedAt }: { messageId: string; content: string; editedAt: string }) => {
      useDMStore.getState().applyEdit(messageId, content, editedAt);
    };

    // Real-time delete (partner sees message disappear instantly)
    const onDeleted = ({ messageId }: { messageId: string }) => {
      useDMStore.getState().applyDelete(messageId);
    };

    // Real-time pin toggle
    const onPinned = ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      useDMStore.getState().applyPinToggle(messageId, pinned);
    };

    // Real-time reactions
    const onReacted = ({ messageId, reactions }: { messageId: string; reactions: { emoji: string; userId: string }[] }) => {
      useDMStore.getState().applyReaction(messageId, reactions);
    };

    _socket.on('dm:message',         onMessage);
    _socket.on('dm:conversation:update', onConvUpdate);
    _socket.on('dm:typing:update',   onTyping);
    _socket.on('dm:message:edited',  onEdited);
    _socket.on('dm:message:deleted', onDeleted);
    _socket.on('dm:message:pinned',  onPinned);
    _socket.on('dm:message:reacted', onReacted);

    return () => {
      _socket?.off('dm:message',         onMessage);
      _socket?.off('dm:conversation:update', onConvUpdate);
      _socket?.off('dm:typing:update',   onTyping);
      _socket?.off('dm:message:edited',  onEdited);
      _socket?.off('dm:message:deleted', onDeleted);
      _socket?.off('dm:message:pinned',  onPinned);
      _socket?.off('dm:message:reacted', onReacted);
    };
  }, [token]);

  const joinDMRoom = useCallback((conversationId: string) => {
    _socket?.emit('dm:join', { conversationId });
  }, []);

  const sendDM = useCallback((conversationId: string, content: string, replyToId?: string, mediaUrl?: string, mediaType?: 'image' | 'video') => {
    _socket?.emit('dm:send', { conversationId, content, replyToId, mediaUrl, mediaType });
  }, []);

  const sendDMTyping = useCallback((conversationId: string, typing: boolean) => {
    _socket?.emit('dm:typing', { conversationId, typing });
  }, []);

  const sendDMEdit = useCallback((messageId: string, content: string) => {
    _socket?.emit('dm:edit', { messageId, content });
  }, []);

  return { joinDMRoom, sendDM, sendDMTyping, sendDMEdit };
}
