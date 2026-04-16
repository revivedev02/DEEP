import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';
import { useUIStore } from '@/store/useUIStore';

let socketInstance: Socket | null = null;

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const { addMessage, setOnline, setConnected } = useChatStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || initialized.current) return;
    initialized.current = true;

    socketInstance = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));
    socketInstance.on('connect_error', (err) => {
      console.warn('[socket] connect error:', err.message);
      setConnected(false);
    });

    // Only add the message if it belongs to the currently active channel
    socketInstance.on('message:new', (msg: ChatMessage) => {
      const activeChannel = useUIStore.getState().activeChannel;
      if (msg.channelId === activeChannel) {
        addMessage(msg);
      }
    });

    socketInstance.on('presence:update', ({ userId, online }: { userId: string; online: boolean }) => {
      setOnline(userId, online);
    });

    socketInstance.on('typing:update', ({ displayName, typing }: { displayName: string; typing: boolean }) => {
      useChatStore.getState().setTyping(displayName, typing);
    });

    return () => {};
  }, [token]);

  /** Join a channel room on the server. Call whenever activeChannel changes. */
  const joinChannel = (channelId: string) => {
    socketInstance?.emit('channel:join', { channelId });
  };

  /** Send a message to a specific channel, optionally as a reply. */
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
    initialized.current = false;
    setConnected(false);
  };

  return { sendMessage, sendTyping, joinChannel, disconnectSocket };
}
