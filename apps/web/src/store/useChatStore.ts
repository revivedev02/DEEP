import { create } from 'zustand';

export interface ReplyUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isAdmin: boolean;
}

export interface RawReaction {
  emoji: string;
  userId: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  channelId: string;
  createdAt: string;
  editedAt?: string | null;
  pinned?: boolean;
  reactions?: RawReaction[];
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
  isLoadingOlder:     boolean;
  hasMore:            boolean;
  loadError:          string | null;
  typingUsers:        string[];
  replyingTo:         ChatMessage | null;

  addMessage:         (msg: ChatMessage) => void;
  setMessages:        (msgs: ChatMessage[]) => void;
  clearMessages:      () => void;
  prependMessages:    (msgs: ChatMessage[]) => void;
  setPinnedMessages:  (msgs: ChatMessage[]) => void;
  applyPinToggle:     (messageId: string, pinned: boolean) => void;
  applyEdit:          (messageId: string, content: string, editedAt: string) => void;
  applyReaction:      (messageId: string, reactions: RawReaction[]) => void;
  setOnline:          (userId: string, online: boolean) => void;
  setOnlineSnapshot:  (userIds: string[]) => void;
  setConnected:       (v: boolean) => void;
  clearMessages:      () => void;
  setLoadingMessages: (v: boolean) => void;
  setLoadingOlder:    (v: boolean) => void;
  setHasMore:         (v: boolean) => void;
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
  isLoadingOlder:    false,
  hasMore:           true,
  loadError:         null,
  retryTick:         0,
  typingUsers:       [],
  replyingTo:        null,

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  setMessages: (msgs) => set({ messages: msgs, isLoadingMessages: false, loadError: null, hasMore: msgs.length >= 50 }),

  // Clears the list AND keeps isLoadingMessages:true — use before starting a fresh fetch
  clearMessages: () => set({ messages: [], isLoadingMessages: true, loadError: null, hasMore: true }),

  prependMessages: (msgs) =>
    set((s) => ({
      messages: [...msgs, ...s.messages],
      isLoadingOlder: false,
      hasMore: msgs.length >= 50,
    })),

  setPinnedMessages: (msgs) => set({ pinnedMessages: msgs }),

  // Called by socket event or after PATCH — only updates pinned flag on messages list.
  // pinnedMessages is refreshed separately by handlePin after the server confirms.
  applyPinToggle: (messageId, pinned) =>
    set((s) => {
      const foundMsg = s.messages.find((m) => m.id === messageId);
      return {
        messages: s.messages.map((m) =>
          m.id === messageId ? { ...m, pinned } : m
        ),
        pinnedMessages: pinned
          ? s.pinnedMessages.some((m) => m.id === messageId)
            ? s.pinnedMessages.map((m) => m.id === messageId ? { ...m, pinned: true } : m)
            : foundMsg
              ? [...s.pinnedMessages, { ...foundMsg, pinned: true }]
              : s.pinnedMessages // message not in cache — skip, handlePin will re-fetch
          : s.pinnedMessages.filter((m) => m.id !== messageId),
      };
    }),

  applyEdit: (messageId, content, editedAt) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content, editedAt } : m
      ),
    })),

  applyReaction: (messageId, reactions) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      ),
    })),

  setOnline: (userId, online) =>
    set((s) => {
      const next = new Set(s.onlineUsers);
      online ? next.add(userId) : next.delete(userId);
      return { onlineUsers: next };
    }),

  setOnlineSnapshot: (userIds) => set({ onlineUsers: new Set(userIds) }),

  setConnected:      (v) => set({ isConnected: v }),
  setLoadingMessages:(v) => set({ isLoadingMessages: v }),
  setLoadingOlder:   (v) => set({ isLoadingOlder: v }),
  setHasMore:        (v) => set({ hasMore: v }),
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
