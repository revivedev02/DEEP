import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { useMembersStore } from '@/store/useMembersStore';
import { useUIStore } from '@/store/useUIStore';

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
      // Update all cached messages by this user
      useChatStore.getState().updateUserAvatar(userId, avatarUrl);
      // Update member list
      useMembersStore.getState().updateMemberAvatar(userId, avatarUrl);
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
