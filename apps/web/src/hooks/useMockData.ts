import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import type { ChatMessage } from '@/store/useChatStore';

// ─── Mock members for UI demo when server is offline ───────────────────────
export const MOCK_MEMBERS = [
  { id: 'u1', displayName: 'Admin',    username: 'admin',    isAdmin: true,  avatarUrl: undefined },
  { id: 'u2', displayName: 'Alex',     username: 'alex',     isAdmin: false, avatarUrl: undefined },
  { id: 'u3', displayName: 'Jordan',   username: 'jordan',   isAdmin: false, avatarUrl: undefined },
  { id: 'u4', displayName: 'Morgan',   username: 'morgan',   isAdmin: false, avatarUrl: undefined },
  { id: 'u5', displayName: 'Riley',    username: 'riley',    isAdmin: false, avatarUrl: undefined },
];

function makeMsg(
  id: string, userId: string, content: string,
  offsetMins: number, user: typeof MOCK_MEMBERS[0]
): ChatMessage {
  const d = new Date(Date.now() - offsetMins * 60 * 1000);
  return { id, content, userId, channelId: 'general', createdAt: d.toISOString(), user };
}

const SEED_MESSAGES: ChatMessage[] = [
  makeMsg('m1', 'u1', 'Welcome everyone! This is Private Discord Lite 🎉', 90, MOCK_MEMBERS[0]),
  makeMsg('m2', 'u2', 'Looks amazing! The UI is so clean', 88, MOCK_MEMBERS[1]),
  makeMsg('m3', 'u3', 'No password needed? That\'s wild 🔐', 85, MOCK_MEMBERS[2]),
  makeMsg('m4', 'u1', 'Yep — just paste your ID and you\'re in. Super simple auth flow.', 84, MOCK_MEMBERS[0]),
  makeMsg('m5', 'u4', 'When\'s voice dropping?', 60, MOCK_MEMBERS[3]),
  makeMsg('m6', 'u1', 'Voice is coming soon™ — WebRTC mesh is next on the list 🎤', 58, MOCK_MEMBERS[0]),
  makeMsg('m7', 'u5', 'Can\'t wait. This already feels like home', 30, MOCK_MEMBERS[4]),
  makeMsg('m8', 'u2', 'Agreed. Way faster than Discord lol', 25, MOCK_MEMBERS[1]),
  makeMsg('m9', 'u3', 'Also no bloat — love it', 20, MOCK_MEMBERS[2]),
  makeMsg('m10','u4', 'How many people can this support?', 10, MOCK_MEMBERS[3]),
  makeMsg('m11','u1', 'Text is unlimited. Voice mesh scales well up to ~10 users P2P.', 9, MOCK_MEMBERS[0]),
  makeMsg('m12','u5', '🔥🔥🔥', 5, MOCK_MEMBERS[4]),
];

export function useMockData() {
  const { setMessages, setOnline } = useChatStore();
  const { user } = useAuthStore();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    // seed messages
    setMessages(SEED_MESSAGES);

    // mark first 3 as online
    setOnline('u1', true);
    setOnline('u2', true);
    setOnline('u3', true);
    if (user) setOnline(user.id, true);
  }, []);
}
