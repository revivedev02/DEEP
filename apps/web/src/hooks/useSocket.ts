import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { useMembersStore } from '@/store/useMembersStore';
import { useUIStore } from '@/store/useUIStore';
import { setDMSocket } from '@/hooks/useDMSocket';

// ── True singleton — shared across every component that calls useSocket() ────
let socketInstance: Socket | null = null;

/** Emit avatar update after successful upload — notifies all clients */
export function emitAvatarUpdate(avatarUrl: string) {
  socketInstance?.emit('avatar:update', { avatarUrl });
}

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const { addMessage, setOnline, setConnected } = useChatStore();

  useEffect(() => {
    if (!token || socketInstance) return;

    socketInstance = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    setDMSocket(socketInstance);

    socketInstance.on('connect',    () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));
    socketInstance.on('connect_error', (err) => {
      console.warn('[socket] connect error:', err.message);
      setConnected(false);
    });

    socketInstance.on('message:new', (msg: ChatMessage) => {
      const activeChannel = useUIStore.getState().activeChannel;
      if (msg.channelId === activeChannel) addMessage(msg);
    });

    socketInstance.on('presence:update', ({ userId, online }: { userId: string; online: boolean }) => {
      setOnline(userId, online);
    });

    socketInstance.on('typing:update', ({ displayName, typing }: { displayName: string; typing: boolean }) => {
      useChatStore.getState().setTyping(displayName, typing);
    });

    // ── Real-time avatar propagation ─────────────────────────────────────────
    socketInstance.on('user:avatar-updated', ({ userId, avatarUrl }: { userId: string; avatarUrl: string }) => {
      useChatStore.getState().updateUserAvatar(userId, avatarUrl);
      useMembersStore.getState().updateMemberAvatar(userId, avatarUrl);
    });

    // ── Real-time pin/unpin ───────────────────────────────────────────────────
    socketInstance.on('message:pinned', ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      useChatStore.getState().applyPinToggle(messageId, pinned);
    });

    // ── Real-time message edit ────────────────────────────────────────────────
    socketInstance.on('message:edited', ({ messageId, content, editedAt }: { messageId: string; content: string; editedAt: string }) => {
      useChatStore.getState().applyEdit(messageId, content, editedAt);
    });

    // ── Real-time emoji reactions ─────────────────────────────────────────────
    socketInstance.on('message:reaction', ({ messageId, reactions }: { messageId: string; reactions: { emoji: string; userId: string }[] }) => {
      useChatStore.getState().applyReaction(messageId, reactions);
    });

    return () => {};
  }, [token]);

  const joinChannel = (channelId: string) => {
    socketInstance?.emit('channel:join', { channelId });
  };

  const sendMessage = (content: string, channelId: string, replyToId?: string) => {
    socketInstance?.emit('message:send', { content, channelId, replyToId });
  };

  const sendTyping = (typing: boolean) => {
    const channelId = useUIStore.getState().activeChannel;
    socketInstance?.emit('typing', { typing, channelId });
  };

  const disconnectSocket = () => {
    socketInstance?.disconnect();
    socketInstance = null;
    setConnected(false);
  };

  return { sendMessage, sendTyping, joinChannel, disconnectSocket };
}
