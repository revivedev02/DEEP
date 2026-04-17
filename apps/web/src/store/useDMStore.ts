import { create } from 'zustand';

export interface DMUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

export interface DMReaction {
  emoji: string;
  userId: string;
}

export interface DMMessage {
  id: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  conversationId: string;
  userId: string;
  user: DMUser;
  reactions: DMReaction[];
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    user: DMUser;
  } | null;
}

export interface DMConversation {
  id: string;
  createdAt: string;
  partner: DMUser | null;
  lastMessage: DMMessage | null;
  unreadCount?: number;
}

interface DMState {
  conversations:  DMConversation[];
  messages:       DMMessage[];
  isLoading:      boolean;
  isLoadingOlder: boolean;
  hasMore:        boolean;
  typingUsers:    string[];

  setConversations:   (c: DMConversation[]) => void;
  upsertConversation: (c: DMConversation) => void;
  setMessages:        (msgs: DMMessage[]) => void;
  prependMessages:    (msgs: DMMessage[]) => void;
  addMessage:         (msg: DMMessage) => void;
  applyEdit:          (id: string, content: string, editedAt: string) => void;
  applyDelete:        (id: string) => void;
  applyReaction:      (id: string, reactions: DMReaction[]) => void;
  setLoading:         (v: boolean) => void;
  setLoadingOlder:    (v: boolean) => void;
  setHasMore:         (v: boolean) => void;
  setTyping:          (displayName: string, typing: boolean) => void;
  updateConversationLastMessage: (conversationId: string, lastMessage: DMMessage) => void;
}

export const useDMStore = create<DMState>((set) => ({
  conversations:  [],
  messages:       [],
  isLoading:      false,
  isLoadingOlder: false,
  hasMore:        true,
  typingUsers:    [],

  setConversations: (conversations) => set({ conversations }),

  upsertConversation: (c) =>
    set((s) => {
      const exists = s.conversations.find(x => x.id === c.id);
      if (exists) return { conversations: s.conversations.map(x => x.id === c.id ? c : x) };
      return { conversations: [c, ...s.conversations] };
    }),

  setMessages:  (msgs) => set({ messages: msgs, isLoading: false, hasMore: msgs.length >= 50 }),

  prependMessages: (msgs) =>
    set((s) => ({
      messages: [...msgs, ...s.messages],
      isLoadingOlder: false,
      hasMore: msgs.length >= 50,
    })),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  applyEdit: (id, content, editedAt) =>
    set((s) => ({
      messages: s.messages.map(m => m.id === id ? { ...m, content, editedAt } : m),
    })),

  applyDelete: (id) =>
    set((s) => ({ messages: s.messages.filter(m => m.id !== id) })),

  applyReaction: (id, reactions) =>
    set((s) => ({
      messages: s.messages.map(m => m.id === id ? { ...m, reactions } : m),
    })),

  setLoading:      (v) => set({ isLoading: v }),
  setLoadingOlder: (v) => set({ isLoadingOlder: v }),
  setHasMore:      (v) => set({ hasMore: v }),

  setTyping: (displayName, typing) =>
    set((s) => ({
      typingUsers: typing
        ? [...s.typingUsers.filter(n => n !== displayName), displayName]
        : s.typingUsers.filter(n => n !== displayName),
    })),

  updateConversationLastMessage: (conversationId, lastMessage) =>
    set((s) => ({
      conversations: s.conversations.map(c =>
        c.id === conversationId ? { ...c, lastMessage } : c
      ),
    })),
}));
