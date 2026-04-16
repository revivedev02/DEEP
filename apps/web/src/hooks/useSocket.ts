import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore, type ChatMessage } from '@/store/useChatStore';

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

    socketInstance.on('message:new', (msg: ChatMessage) => {
      addMessage(msg);
    });

    socketInstance.on('presence:update', ({ userId, online }: { userId: string; online: boolean }) => {
      setOnline(userId, online);
    });

    socketInstance.on('typing:update', ({ displayName, typing }: { displayName: string; typing: boolean }) => {
      useChatStore.getState().setTyping(displayName, typing);
    });

    // Cleanup only on unmount (keep socket alive between re-renders)
    return () => {};
  }, [token]);

  const sendMessage = (content: string) => {
    socketInstance?.emit('message:send', { content });
  };

  const sendTyping = (typing: boolean) => {
    socketInstance?.emit('typing', { typing });
  };

  const disconnectSocket = () => {
    socketInstance?.disconnect();
    socketInstance = null;
    initialized.current = false;
    setConnected(false);
  };

  return { sendMessage, sendTyping, disconnectSocket };
}
