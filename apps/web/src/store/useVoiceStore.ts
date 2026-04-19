/**
 * useVoiceStore.ts
 * Zustand store for voice channel UI state.
 * The mediasoup connection logic lives in useVoiceChannel.ts — this store
 * is only for reactive UI state (who's in the channel, muted, speaking, etc.)
 */
import { create } from 'zustand';

export interface VoiceParticipant {
  userId:      string;
  displayName: string;
  avatarUrl:   string | null;
  isMuted:     boolean;
  isSpeaking:  boolean;
  producerId:  string | null;  // null before they start producing
}

interface VoiceStore {
  /** Which voice channel we're connected to (null = not in voice) */
  channelId:    string | null;
  channelName:  string | null;
  participants: VoiceParticipant[];
  isMuted:      boolean;
  isDeafened:   boolean;
  isConnecting: boolean;

  /** Screen sharing state */
  isScreenSharing:    boolean;
  screenShareStream:  MediaStream | null;   // video stream to render
  screenShareOwner:   string | null;        // displayName of the sharer

  // ── Setters ────────────────────────────────────────────────────────────────
  setChannelId:    (id: string | null, name?: string | null) => void;
  setParticipants: (participants: VoiceParticipant[]) => void;
  upsertParticipant: (p: VoiceParticipant) => void;
  removeParticipant: (userId: string) => void;
  setParticipantMuted:    (userId: string, isMuted: boolean) => void;
  setParticipantSpeaking: (userId: string, isSpeaking: boolean) => void;
  setMuted:       (v: boolean) => void;
  setDeafened:    (v: boolean) => void;
  setConnecting:  (v: boolean) => void;
  setScreenSharing:    (v: boolean) => void;
  setScreenShareStream:(stream: MediaStream | null, owner: string | null) => void;
  reset:          () => void;
}

const defaults = {
  channelId:         null,
  channelName:       null,
  participants:      [],
  isMuted:           false,
  isDeafened:        false,
  isConnecting:      false,
  isScreenSharing:   false,
  screenShareStream: null,
  screenShareOwner:  null,
};

export const useVoiceStore = create<VoiceStore>((set) => ({
  ...defaults,

  setChannelId: (channelId, channelName = null) =>
    set({ channelId, channelName }),

  setParticipants: (participants) =>
    set({ participants }),

  upsertParticipant: (p) =>
    set((s) => {
      const exists = s.participants.some(x => x.userId === p.userId);
      return {
        participants: exists
          ? s.participants.map(x => x.userId === p.userId ? { ...x, ...p } : x)
          : [...s.participants, p],
      };
    }),

  removeParticipant: (userId) =>
    set((s) => ({ participants: s.participants.filter(x => x.userId !== userId) })),

  setParticipantMuted: (userId, isMuted) =>
    set((s) => ({
      participants: s.participants.map(x =>
        x.userId === userId ? { ...x, isMuted } : x
      ),
    })),

  setParticipantSpeaking: (userId, isSpeaking) =>
    set((s) => ({
      participants: s.participants.map(x =>
        x.userId === userId ? { ...x, isSpeaking } : x
      ),
    })),

  setMuted:      (isMuted)     => set({ isMuted }),
  setDeafened:   (isDeafened)  => set({ isDeafened }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setScreenSharing:   (isScreenSharing)  => set({ isScreenSharing }),
  setScreenShareStream: (screenShareStream, screenShareOwner) =>
    set({ screenShareStream, screenShareOwner }),

  reset: () => set({ ...defaults, screenShareStream: null }),
}));
