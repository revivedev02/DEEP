import { create } from 'zustand';

export interface ReplyUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isAdmin: boolean;
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  channelId: string;
  createdAt: string;
  pinned?: boolean;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    user: ReplyUser;
  } | null;
  user: ReplyUser;
}

interface ChatState {
  messages:           ChatMessage[];
  pinnedMessages:     ChatMessage[];
  onlineUsers:        Set<string>;
  isConnected:        boolean;
  isLoadingMessages:  boolean;
  loadError:          string | null;
  typingUsers:        string[];
  replyingTo:         ChatMessage | null;

  addMessage:         (msg: ChatMessage) => void;
  setMessages:        (msgs: ChatMessage[]) => void;
  setPinnedMessages:  (msgs: ChatMessage[]) => void;
  applyPinToggle:     (messageId: string, pinned: boolean) => void;
  setOnline:          (userId: string, online: boolean) => void;
  setConnected:       (v: boolean) => void;
  clearMessages:      () => void;
  setLoadingMessages: (v: boolean) => void;
  setLoadError:       (err: string | null) => void;
  retryTick:          number;
  retryMessages:      () => void;
  setTyping:          (displayName: string, typing: boolean) => void;
  setReplyingTo:      (msg: ChatMessage | null) => void;
  updateUserAvatar:   (userId: string, avatarUrl: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages:          [],
  pinnedMessages:    [],
  onlineUsers:       new Set(),
  isConnected:       false,
  isLoadingMessages: true,
  loadError:         null,
  retryTick:         0,
  typingUsers:       [],
  replyingTo:        null,

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg].slice(-500) })),

  setMessages: (msgs) => set({ messages: msgs, isLoadingMessages: false, loadError: null }),

  setPinnedMessages: (msgs) => set({ pinnedMessages: msgs }),

  // Called when a message:pinned socket event arrives or after PATCH succeeds
  applyPinToggle: (messageId, pinned) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, pinned } : m
      ),
      pinnedMessages: pinned
        ? // add if not already present
          s.pinnedMessages.some((m) => m.id === messageId)
            ? s.pinnedMessages
            : [
                ...s.pinnedMessages,
                { ...s.messages.find((m) => m.id === messageId)!, pinned: true },
              ]
        : s.pinnedMessages.filter((m) => m.id !== messageId),
    })),

  setOnline: (userId, online) =>
    set((s) => {
      const next = new Set(s.onlineUsers);
      online ? next.add(userId) : next.delete(userId);
      return { onlineUsers: next };
    }),

  setConnected:      (v) => set({ isConnected: v }),
  clearMessages:     ()  => set({ messages: [], loadError: null, pinnedMessages: [] }),
  setLoadingMessages:(v) => set({ isLoadingMessages: v }),
  setLoadError:      (err) => set({ loadError: err, isLoadingMessages: false }),
  retryMessages:     () => set((s) => ({ loadError: null, isLoadingMessages: true, retryTick: s.retryTick + 1 })),

  setTyping: (displayName, typing) =>
    set((s) => ({
      typingUsers: typing
        ? [...s.typingUsers.filter((n) => n !== displayName), displayName]
        : s.typingUsers.filter((n) => n !== displayName),
    })),

  setReplyingTo: (msg) => set({ replyingTo: msg }),

  updateUserAvatar: (userId, avatarUrl) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.user.id === userId ? { ...m, user: { ...m.user, avatarUrl } } : m
      ),
    })),
}));
