/**
 * voiceHandlers.ts
 * Handles all voice:* socket events using mediasoup SFU.
 *
 * Flow per peer:
 *   voice:join → voice:create-transport (×2) → voice:connect-transport (×2)
 *   → voice:produce → voice:consume (for each existing peer)
 *   → [voice:mute, voice:speaking, voice:leave]
 */
import type { Server, Socket } from 'socket.io';
import type { Router, WebRtcTransport, Producer, Consumer } from 'mediasoup/node/lib/types.js';
import {
  getOrCreateRouter,
  destroyRouter,
  createWebRtcTransport,
  getTurnIceServers,
} from '../lib/mediasoupManager.js';

// ── Types ────────────────────────────────────────────────────────────────────
interface VoicePeer {
  socketId:     string;
  userId:       string;
  displayName:  string;
  avatarUrl:    string | null;
  channelId:    string;
  isMuted:      boolean;
  isSpeaking:   boolean;
  sendTransport?: WebRtcTransport;
  recvTransport?: WebRtcTransport;
  producer?:    Producer;
  consumers:    Map<string, Consumer>;  // producerId → Consumer
}

// ── State ────────────────────────────────────────────────────────────────────
const peers        = new Map<string, VoicePeer>();             // socketId → Peer
const channelPeers = new Map<string, Set<string>>();           // channelId → socketId[]

// ── Helpers ──────────────────────────────────────────────────────────────────
function getPeersInChannel(channelId: string): VoicePeer[] {
  const ids = channelPeers.get(channelId) ?? new Set();
  return [...ids].map(id => peers.get(id)!).filter(Boolean);
}

function serializePeer(p: VoicePeer) {
  return {
    userId:      p.userId,
    displayName: p.displayName,
    avatarUrl:   p.avatarUrl,
    isMuted:     p.isMuted,
    isSpeaking:  p.isSpeaking,
    producerId:  p.producer?.id ?? null,
  };
}

async function cleanupPeer(io: Server, socketId: string) {
  const peer = peers.get(socketId);
  if (!peer) return;

  const { channelId } = peer;

  // Close all mediasoup objects
  peer.consumers.forEach(c => c.close());
  peer.producer?.close();
  peer.sendTransport?.close();
  peer.recvTransport?.close();

  peers.delete(socketId);

  const set = channelPeers.get(channelId);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) {
      channelPeers.delete(channelId);
      destroyRouter(channelId);     // free mediasoup resources
    }
  }

  // Notify remaining peers
  io.to(`voice:${channelId}`).emit('voice:peer-left', { userId: peer.userId });
}

// ── Main handler registration ────────────────────────────────────────────────
export function setupVoiceHandlers(io: Server, socket: Socket) {
  const userId      = (socket as any).userId      as string;
  const displayName = (socket as any).displayName as string;
  const avatarUrl   = (socket as any).avatarUrl   as string | null ?? null;

  // ── voice:join ─────────────────────────────────────────────────────────────
  socket.on('voice:join', async ({ channelId }: { channelId: string }) => {
    try {
      // Leave any existing voice channel first
      const existing = peers.get(socket.id);
      if (existing) await cleanupPeer(io, socket.id);

      const router = await getOrCreateRouter(channelId);

      // Register peer
      const peer: VoicePeer = {
        socketId: socket.id,
        userId, displayName, avatarUrl,
        channelId, isMuted: false, isSpeaking: false,
        consumers: new Map(),
      };
      peers.set(socket.id, peer);

      if (!channelPeers.has(channelId)) channelPeers.set(channelId, new Set());
      channelPeers.get(channelId)!.add(socket.id);

      socket.join(`voice:${channelId}`);

      // Send router RTP capabilities to the joining client
      socket.emit('voice:joined', {
        rtpCapabilities: router.rtpCapabilities,
        iceServers:      getTurnIceServers(),
        // Existing peers' producers so client can consume them
        existingProducers: getPeersInChannel(channelId)
          .filter(p => p.socketId !== socket.id && p.producer)
          .map(p => ({
            producerId:  p.producer!.id,
            userId:      p.userId,
            displayName: p.displayName,
            avatarUrl:   p.avatarUrl,
          })),
        // Current participant list
        participants: getPeersInChannel(channelId).map(serializePeer),
      });

      // Notify existing peers
      socket.to(`voice:${channelId}`).emit('voice:peer-joined', {
        userId, displayName, avatarUrl,
        socketId: socket.id,
      });

    } catch (err) {
      console.error('[voice] voice:join error', err);
      socket.emit('voice:error', { message: 'Failed to join voice channel' });
    }
  });

  // ── voice:create-transport ─────────────────────────────────────────────────
  socket.on('voice:create-transport', async ({ direction }: { direction: 'send' | 'recv' }) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) return;

      const router    = await getOrCreateRouter(peer.channelId);
      const transport = await createWebRtcTransport(router);

      if (direction === 'send') {
        peer.sendTransport = transport;
      } else {
        peer.recvTransport = transport;
      }

      socket.emit('voice:transport-created', {
        direction,
        id:             transport.id,
        iceParameters:  transport.iceParameters,
        iceCandidates:  transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        iceServers:     getTurnIceServers(),
      });

    } catch (err) {
      console.error('[voice] voice:create-transport error', err);
    }
  });

  // ── voice:connect-transport ────────────────────────────────────────────────
  socket.on('voice:connect-transport', async ({
    transportId, dtlsParameters,
  }: { transportId: string; dtlsParameters: any }) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) return;

      const transport =
        peer.sendTransport?.id === transportId ? peer.sendTransport :
        peer.recvTransport?.id === transportId ? peer.recvTransport : null;

      if (!transport) return;
      await transport.connect({ dtlsParameters });
      socket.emit('voice:transport-connected', { transportId });
    } catch (err) {
      console.error('[voice] voice:connect-transport error', err);
      socket.emit('voice:transport-error', { message: 'connect failed' });
    }
  });

  // ── voice:produce ──────────────────────────────────────────────────────────
  socket.on('voice:produce', async ({
    transportId, kind, rtpParameters,
  }: { transportId: string; kind: 'audio'; rtpParameters: any }) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer || !peer.sendTransport) return;

      const producer = await peer.sendTransport.produce({ kind, rtpParameters });
      peer.producer  = producer;

      producer.on('score', () => {}); // keep-alive
      producer.on('transportclose', () => producer.close());

      socket.emit('voice:produced', { producerId: producer.id });

      // Notify all other peers — they'll call voice:consume for this producer
      socket.to(`voice:${peer.channelId}`).emit('voice:new-producer', {
        producerId:  producer.id,
        userId,
        displayName,
        avatarUrl,
      });

    } catch (err) {
      console.error('[voice] voice:produce error', err);
    }
  });

  // ── voice:consume ──────────────────────────────────────────────────────────
  socket.on('voice:consume', async ({
    producerId, rtpCapabilities,
  }: { producerId: string; rtpCapabilities: any }) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer || !peer.recvTransport) return;

      const router = getOrCreateRouter(peer.channelId);
      const resolvedRouter = await router;

      if (!resolvedRouter.canConsume({ producerId, rtpCapabilities })) {
        socket.emit('voice:consume-error', { producerId, reason: 'cannot consume' });
        return;
      }

      const consumer = await peer.recvTransport.consume({
        producerId,
        rtpCapabilities,
        paused: true,   // client calls voice:resume-consumer after receiving params
      });

      peer.consumers.set(producerId, consumer);

      consumer.on('transportclose', () => { consumer.close(); peer.consumers.delete(producerId); });
      consumer.on('producerclose',  () => {
        consumer.close();
        peer.consumers.delete(producerId);
        socket.emit('voice:producer-closed', { producerId });
      });

      socket.emit('voice:consume-ready', {
        consumerId:     consumer.id,
        producerId,
        kind:           consumer.kind,
        rtpParameters:  consumer.rtpParameters,
      });

    } catch (err) {
      console.error('[voice] voice:consume error', err);
    }
  });

  // ── voice:resume-consumer ──────────────────────────────────────────────────
  socket.on('voice:resume-consumer', async ({ consumerId }: { consumerId: string }) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) return;
      const consumer = [...peer.consumers.values()].find(c => c.id === consumerId);
      await consumer?.resume();
    } catch (err) {
      console.error('[voice] voice:resume-consumer error', err);
    }
  });

  // ── voice:mute ─────────────────────────────────────────────────────────────
  socket.on('voice:mute', async ({ isMuted }: { isMuted: boolean }) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) return;
      peer.isMuted = isMuted;

      if (peer.producer) {
        isMuted ? await peer.producer.pause() : await peer.producer.resume();
      }

      io.to(`voice:${peer.channelId}`).emit('voice:peer-muted', { userId, isMuted });
    } catch (err) {
      console.error('[voice] voice:mute error', err);
    }
  });

  // ── voice:speaking ─────────────────────────────────────────────────────────
  // Throttled client-side to ~150ms, just relay to channel
  socket.on('voice:speaking', ({ isSpeaking }: { isSpeaking: boolean }) => {
    const peer = peers.get(socket.id);
    if (!peer) return;
    peer.isSpeaking = isSpeaking;
    socket.to(`voice:${peer.channelId}`).emit('voice:peer-speaking', { userId, isSpeaking });
  });

  // ── voice:leave ────────────────────────────────────────────────────────────
  socket.on('voice:leave', async () => {
    socket.leave(`voice:${peers.get(socket.id)?.channelId}`);
    await cleanupPeer(io, socket.id);
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    await cleanupPeer(io, socket.id);
  });
}
