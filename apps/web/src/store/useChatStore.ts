import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  channelId: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
    isAdmin: boolean;
  };
}

interface ChatState {
  messages: ChatMessage[];
  onlineUsers: Set<string>;
  isConnected: boolean;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setOnline: (userId: string, online: boolean) => void;
  setConnected: (v: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  onlineUsers: new Set(),
  isConnected: false,
  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, msg].slice(-500), // keep last 500
    })),
  setMessages: (msgs) => set({ messages: msgs }),
  setOnline: (userId, online) =>
    set((s) => {
      const next = new Set(s.onlineUsers);
      online ? next.add(userId) : next.delete(userId);
      return { onlineUsers: next };
    }),
  setConnected: (v) => set({ isConnected: v }),
  clearMessages: () => set({ messages: [] }),
}));
