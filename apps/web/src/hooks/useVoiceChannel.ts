/**
 * useVoiceChannel.ts
 * Core WebRTC/mediasoup hook. Manages the entire connection lifecycle:
 *   join → load device → create transports → produce audio → consume peers
 *   → speaking detection → mute/deafen → leave/cleanup
 *
 * All UI-reactive state is written to useVoiceStore.
 * This hook only needs to be mounted once (in ChatPage or a root provider).
 */
import { useEffect, useRef, useCallback } from 'react';
import { Device, types as mediasoupTypes } from 'mediasoup-client';
import { getSocketInstance }               from '@/hooks/useSocket';
import { useAuthStore }                    from '@/store/useAuthStore';
import { useVoiceStore }                   from '@/store/useVoiceStore';

// Volume analysis interval (ms) — throttle speaking detection
const SPEAKING_INTERVAL = 150;
const SPEAKING_THRESHOLD = 10; // 0-255 RMS amplitude

// ── Refs for mediasoup objects (not stored in React state) ──────────────────
let device:        Device | null                    = null;
let sendTransport: mediasoupTypes.Transport | null  = null;
let recvTransport: mediasoupTypes.Transport | null  = null;
let producer:      mediasoupTypes.Producer | null   = null;
const consumers    = new Map<string, mediasoupTypes.Consumer>(); // producerId → Consumer

let localStream:   MediaStream | null  = null;
let audioCtx:      AudioContext | null = null;
let analyser:      AnalyserNode | null = null;
let speakTimer:    ReturnType<typeof setInterval> | null = null;

// Pending producers to consume once recv transport is ready
let pendingProducers: Array<{ producerId: string }> = [];

// ────────────────────────────────────────────────────────────────────────────
export function useVoiceChannel() {
  const { user } = useAuthStore();
  const joined  = useRef(false);

  // ── Speaking detection ────────────────────────────────────────────────────
  const startSpeakingDetection = useCallback((stream: MediaStream) => {
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let wasSpeaking = false;

    speakTimer = setInterval(() => {
      if (!analyser) return;
      analyser.getByteFrequencyData(buf);
      const rms = buf.reduce((a, b) => a + b, 0) / buf.length;
      const isSpeaking = rms > SPEAKING_THRESHOLD;

      if (isSpeaking !== wasSpeaking) {
        wasSpeaking = isSpeaking;
        getSocketInstance()?.emit('voice:speaking', { isSpeaking });
        if (user?.id) useVoiceStore.getState().setParticipantSpeaking(user.id, isSpeaking);
      }
    }, SPEAKING_INTERVAL);
  }, [user?.id]);

  // ── Full cleanup ──────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (speakTimer) { clearInterval(speakTimer); speakTimer = null; }
    analyser = null;
    audioCtx?.close(); audioCtx = null;

    localStream?.getTracks().forEach(t => t.stop());
    localStream = null;

    consumers.forEach(c => c.close()); consumers.clear();
    producer?.close();     producer     = null;
    sendTransport?.close(); sendTransport = null;
    recvTransport?.close(); recvTransport = null;
    device = null;
    pendingProducers = [];

    joined.current = false;
    useVoiceStore.getState().reset();
  }, []);

  // ── Consume a producer from another peer ─────────────────────────────────
  const consumePeer = useCallback(async (producerId: string) => {
    if (!recvTransport || !device) return;
    getSocketInstance()?.emit('voice:consume', {
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });
  }, []);

  // ── Join a voice channel ──────────────────────────────────────────────────
  const joinChannel = useCallback(async (channelId: string, channelName: string) => {
    const socket = getSocketInstance();
    if (!socket || joined.current) return;
    joined.current = true;

    useVoiceStore.getState().setChannelId(channelId, channelName);
    useVoiceStore.getState().setConnecting(true);

    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      socket.emit('voice:join', { channelId });
    } catch (err) {
      console.error('[voice] Failed to get microphone', err);
      joined.current = false;
      useVoiceStore.getState().reset();
    }
  }, []);

  // ── Leave voice channel ───────────────────────────────────────────────────
  const leaveChannel = useCallback(() => {
    getSocketInstance()?.emit('voice:leave');
    cleanup();
  }, [cleanup]);

  // ── Mute / unmute ─────────────────────────────────────────────────────────
  const setMuted = useCallback((isMuted: boolean) => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    getSocketInstance()?.emit('voice:mute', { isMuted });
    useVoiceStore.getState().setMuted(isMuted);
    if (user?.id) useVoiceStore.getState().setParticipantMuted(user.id, isMuted);
  }, [user?.id]);

  // ── Deafen / undeafen ─────────────────────────────────────────────────────
  const setDeafened = useCallback((isDeafened: boolean) => {
    consumers.forEach(c => {
      const el = document.getElementById(`audio-${c.id}`) as HTMLAudioElement | null;
      if (el) el.muted = isDeafened;
    });
    useVoiceStore.getState().setDeafened(isDeafened);
  }, []);

  // ── Socket event listeners ────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket) return;

    // Server confirmed join + sent router RTP capabilities
    socket.on('voice:joined', async ({
      rtpCapabilities, iceServers, existingProducers, participants,
    }: any) => {
      try {
        device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });

        socket.emit('voice:create-transport', { direction: 'send' });
        socket.emit('voice:create-transport', { direction: 'recv' });

        useVoiceStore.getState().setParticipants(participants);
        useVoiceStore.getState().setConnecting(false);

        pendingProducers = existingProducers ?? [];
      } catch (err) {
        console.error('[voice] Device load failed', err);
        cleanup();
      }
    });

    // Transport created by server
    socket.on('voice:transport-created', async ({
      direction, id, iceParameters, iceCandidates, dtlsParameters, iceServers,
    }: any) => {
      if (!device) return;

      const transport = direction === 'send'
        ? device.createSendTransport({ id, iceParameters, iceCandidates, dtlsParameters, iceServers })
        : device.createRecvTransport({ id, iceParameters, iceCandidates, dtlsParameters, iceServers });

      // mediasoup-client fires 'connect' when DTLS handshake is needed
      transport.on('connect', ({ dtlsParameters: dp }, callback, errback) => {
        socket.emit('voice:connect-transport', { transportId: id, dtlsParameters: dp });
        socket.once('voice:transport-connected', callback);
        socket.once('voice:transport-error',     errback);
      });

      if (direction === 'send') {
        sendTransport = transport;

        transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
          socket.emit('voice:produce', { transportId: id, kind, rtpParameters });
          socket.once('voice:produced', ({ producerId }: any) => callback({ id: producerId }));
          socket.once('voice:produce-error', errback);
        });

        // Start producing audio
        if (localStream) {
          const track = localStream.getAudioTracks()[0];
          producer = await sendTransport.produce({
            track,
            codecOptions: { opusStereo: false, opusDtx: true },
          });
          startSpeakingDetection(localStream);
        }

      } else {
        recvTransport = transport;

        // Consume producers that arrived before recv transport was ready
        for (const p of pendingProducers) {
          await consumePeer(p.producerId);
        }
        pendingProducers = [];
      }
    });

    // Server sends audio track params — create consumer and play audio
    socket.on('voice:consume-ready', async ({
      consumerId, producerId, kind, rtpParameters,
    }: any) => {
      if (!recvTransport) return;
      try {
        const consumer = await recvTransport.consume({ id: consumerId, producerId, kind, rtpParameters });
        consumers.set(producerId, consumer);

        const audioEl = document.createElement('audio');
        audioEl.id     = `audio-${consumerId}`;
        audioEl.autoplay = true;
        audioEl.srcObject = new MediaStream([consumer.track]);
        document.body.appendChild(audioEl);

        socket.emit('voice:resume-consumer', { consumerId });

        consumer.on('transportclose', () => { audioEl.remove(); consumers.delete(producerId); });
      } catch (err) {
        console.error('[voice] consume failed', err);
      }
    });

    // A new peer started producing — consume them
    socket.on('voice:new-producer', async ({ producerId, userId, displayName, avatarUrl }: any) => {
      useVoiceStore.getState().upsertParticipant({
        userId, displayName, avatarUrl, isMuted: false, isSpeaking: false, producerId,
      });
      await consumePeer(producerId);
    });

    // Peer joined channel (before producing)
    socket.on('voice:peer-joined', ({ userId, displayName, avatarUrl }: any) => {
      useVoiceStore.getState().upsertParticipant({
        userId, displayName, avatarUrl, isMuted: false, isSpeaking: false, producerId: null,
      });
    });

    // Peer left
    socket.on('voice:peer-left', ({ userId }: any) => {
      useVoiceStore.getState().removeParticipant(userId);
      consumers.forEach((c) => {
        const audioEl = document.getElementById(`audio-${c.id}`);
        audioEl?.remove();
      });
    });

    socket.on('voice:peer-muted',    ({ userId, isMuted    }: any) =>
      useVoiceStore.getState().setParticipantMuted(userId, isMuted));

    socket.on('voice:peer-speaking', ({ userId, isSpeaking }: any) =>
      useVoiceStore.getState().setParticipantSpeaking(userId, isSpeaking));

    socket.on('voice:producer-closed', ({ producerId }: any) => {
      const consumer = consumers.get(producerId);
      if (consumer) {
        const audioEl = document.getElementById(`audio-${consumer.id}`);
        audioEl?.remove();
        consumer.close();
        consumers.delete(producerId);
      }
    });

    return () => {
      socket.off('voice:joined');
      socket.off('voice:transport-created');
      socket.off('voice:consume-ready');
      socket.off('voice:new-producer');
      socket.off('voice:peer-joined');
      socket.off('voice:peer-left');
      socket.off('voice:peer-muted');
      socket.off('voice:peer-speaking');
      socket.off('voice:producer-closed');
    };
  }, [cleanup, consumePeer, startSpeakingDetection]);

  return { joinChannel, leaveChannel, setMuted, setDeafened };
}
