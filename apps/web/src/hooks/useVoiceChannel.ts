/**
 * useVoiceChannel.ts — LiveKit-powered voice hook
 *
 * Flow:
 *   joinChannel → fetch JWT from /api/voice/token
 *   → room.connect(wsUrl, token)
 *   → localParticipant.setMicrophoneEnabled(true)
 *   → LiveKit handles all media routing, TURN, encryption
 *
 * Speaking detection, mute, deafen, participant tracking all via LiveKit events.
 * All reactive UI state written to useVoiceStore.
 */
import { useCallback }  from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type TrackPublication,
} from 'livekit-client';
import { useAuthStore }  from '@/store/useAuthStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { voiceSounds }   from '@/lib/voiceSounds';

// ── Module-level singleton — survives React re-renders ───────────────────────
let room: Room | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseMetadata(p: Participant): { avatarUrl?: string } {
  try { return JSON.parse(p.metadata ?? '{}'); } catch { return {}; }
}

function upsertFromParticipant(p: Participant) {
  const meta = parseMetadata(p);
  useVoiceStore.getState().upsertParticipant({
    userId:      p.identity,
    displayName: p.name ?? p.identity,
    avatarUrl:   meta.avatarUrl ?? null,
    isMuted:     !p.isMicrophoneEnabled,
    isSpeaking:  false,
    producerId:  null,
  });
}

function cleanupAudio() {
  document.querySelectorAll('[data-lk-audio]').forEach(el => el.remove());
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useVoiceChannel() {
  const { user, token: authToken } = useAuthStore();

  // ── Join ───────────────────────────────────────────────────────────────────
  const joinChannel = useCallback(async (channelId: string, channelName: string) => {
    if (room) return; // already connected

    useVoiceStore.getState().setChannelId(channelId, channelName);
    useVoiceStore.getState().setConnecting(true);

    try {
      // 1. Get signed token + LiveKit URL from our server
      const res = await fetch(`/api/voice/token?channelId=${channelId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Token fetch failed');
      const { token, wsUrl } = await res.json();

      // 2. Create room with adaptive stream + dynacast (audio-only, but future-proof)
      room = new Room({
        adaptiveStream: true,
        dynacast:       true,
      });

      // 3. Wire all events before connecting
      setupRoomEvents();

      // 4. Connect and publish mic
      await room.connect(wsUrl, token);

      // Start audio context (browsers require a user gesture; this is triggered
      // by the click on the voice channel row, so it will succeed)
      await room.startAudio();

      await room.localParticipant.setMicrophoneEnabled(true);

      useVoiceStore.getState().setConnecting(false);

      // Play join sound
      voiceSounds.join();

      // 5. Add self to store
      if (user) {
        upsertFromParticipant(room.localParticipant);
      }

      // 6. Add already-connected remote participants
      room.remoteParticipants.forEach((p) => upsertFromParticipant(p));

    } catch (err) {
      console.error('[voice] joinChannel failed', err);
      room = null;
      useVoiceStore.getState().reset();
    }
  }, [authToken, user]);

  // ── Room events ────────────────────────────────────────────────────────────
  function setupRoomEvents() {
    if (!room) return;

    room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
      upsertFromParticipant(p);
      voiceSounds.join(); // another user joined
    });

    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      useVoiceStore.getState().removeParticipant(p.identity);
      voiceSounds.leave(); // another user left
    });

    // Attach remote audio tracks to the DOM
    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach() as HTMLAudioElement;
        el.setAttribute('data-lk-audio', participant.identity);
        el.style.display = 'none';
        document.body.appendChild(el);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
      track.detach();
      document.querySelector(`[data-lk-audio="${participant.identity}"]`)?.remove();
    });

    // Speaking detection — LiveKit handles VAD natively
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const speakingIds = new Set(speakers.map(s => s.identity));
      const { participants } = useVoiceStore.getState();
      participants.forEach(p => {
        useVoiceStore.getState().setParticipantSpeaking(p.userId, speakingIds.has(p.userId));
      });
    });

    // Mute/unmute events (local + remote)
    room.on(RoomEvent.TrackMuted, (_pub: TrackPublication, participant: Participant) => {
      if (_pub.kind === Track.Kind.Audio) {
        useVoiceStore.getState().setParticipantMuted(participant.identity, true);
      }
    });

    room.on(RoomEvent.TrackUnmuted, (_pub: TrackPublication, participant: Participant) => {
      if (_pub.kind === Track.Kind.Audio) {
        useVoiceStore.getState().setParticipantMuted(participant.identity, false);
      }
    });

    // Disconnected (kicked, network loss, etc.)
    room.on(RoomEvent.Disconnected, () => {
      cleanupAudio();
      room = null;
      useVoiceStore.getState().reset();
    });
  }

  // ── Leave ──────────────────────────────────────────────────────────────────
  const leaveChannel = useCallback(() => {
    voiceSounds.leave();
    room?.disconnect();
    cleanupAudio();
    room = null;
    useVoiceStore.getState().reset();
  }, []);

  // ── Mute / unmute ──────────────────────────────────────────────────────────
  const setMuted = useCallback(async (isMuted: boolean) => {
    await room?.localParticipant.setMicrophoneEnabled(!isMuted);
    useVoiceStore.getState().setMuted(isMuted);
    if (user?.id) useVoiceStore.getState().setParticipantMuted(user.id, isMuted);
    isMuted ? voiceSounds.mute() : voiceSounds.unmute();
  }, [user?.id]);

  // ── Deafen / undeafen ─────────────────────────────────────────────────────
  const setDeafened = useCallback((isDeafened: boolean) => {
    document.querySelectorAll<HTMLAudioElement>('[data-lk-audio]').forEach(el => {
      el.muted = isDeafened;
    });
    useVoiceStore.getState().setDeafened(isDeafened);
    isDeafened ? voiceSounds.deafen() : voiceSounds.undeafen();
  }, []);

  return { joinChannel, leaveChannel, setMuted, setDeafened };
}
