/**
 * mediasoupManager.ts
 * Manages the mediasoup Worker and a pool of Routers (one per active voice channel).
 * Uses TCP-only transport so Railway's HTTPS proxy can forward media via TURN relay.
 */
import * as mediasoup from 'mediasoup';
import type {
  Worker,
  Router,
  WebRtcTransport,
  RtpCodecCapability,
} from 'mediasoup/node/lib/types.js';

// ── Audio codec only ────────────────────────────────────────────────────────
const MEDIA_CODECS: RtpCodecCapability[] = [
  {
    kind:      'audio',
    mimeType:  'audio/opus',
    clockRate: 48000,
    channels:  2,
    parameters: {
      minptime:     10,
      useinbandfec: 1,   // forward-error correction — reduces packet-loss artifacts
    },
  },
];

// ── Singleton worker ────────────────────────────────────────────────────────
let worker: Worker;

// channelId → Router
const routers = new Map<string, Router>();

// Cache public IP on startup to avoid repeated HTTP calls
let announcedIp: string;

// ── Fetch the server's public IP ────────────────────────────────────────────
export async function resolveAnnouncedIp(): Promise<string> {
  if (announcedIp) return announcedIp;

  // Prefer explicit env var (set in Railway) for stability
  if (process.env.MEDIASOUP_ANNOUNCED_IP) {
    announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP;
    return announcedIp;
  }

  try {
    const res = await fetch('https://api4.my-ip.io/ip', { signal: AbortSignal.timeout(4000) });
    announcedIp = (await res.text()).trim();
  } catch {
    announcedIp = '127.0.0.1'; // dev fallback
  }
  return announcedIp;
}

// ── Initialise worker on server startup ─────────────────────────────────────
export async function initMediasoup(): Promise<void> {
  // Fetch TURN credentials from Metered.ca API in parallel with IP resolution
  await Promise.all([
    resolveAnnouncedIp(),
    fetchTurnCredentials(),
  ]);

  worker = await mediasoup.createWorker({
    logLevel:   'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  worker.on('died', (err) => {
    console.error('[mediasoup] Worker died — restarting process', err);
    process.exit(1);
  });

  console.log(`[mediasoup] Worker ready | announcedIp=${announcedIp}`);
}

// ── Router (one per voice channel) ──────────────────────────────────────────
export async function getOrCreateRouter(channelId: string): Promise<Router> {
  let router = routers.get(channelId);
  if (!router) {
    router = await worker.createRouter({ mediaCodecs: MEDIA_CODECS });
    routers.set(channelId, router);
    console.log(`[mediasoup] Router created for channel ${channelId}`);
  }
  return router;
}

export function getRouter(channelId: string): Router | undefined {
  return routers.get(channelId);
}

export function destroyRouter(channelId: string): void {
  const router = routers.get(channelId);
  if (router) {
    router.close();
    routers.delete(channelId);
    console.log(`[mediasoup] Router destroyed for channel ${channelId}`);
  }
}

// ── TURN ice servers — fetched from Metered.ca REST API at startup ───────────
let cachedIceServers: object[] = [];

export async function fetchTurnCredentials(): Promise<void> {
  const apiKey = process.env.METERED_API_KEY;
  const domain = process.env.METERED_DOMAIN ?? 'deepv1.metered.live';

  if (!apiKey) {
    console.warn('[mediasoup] METERED_API_KEY not set — TURN relay disabled (direct only)');
    return;
  }

  try {
    const res = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(6000) },
    );
    cachedIceServers = await res.json();
    console.log(`[mediasoup] TURN credentials fetched — ${cachedIceServers.length} servers from ${domain}`);
  } catch (err) {
    console.error('[mediasoup] Failed to fetch TURN credentials', err);
  }
}

export function getTurnIceServers(): object[] {
  return cachedIceServers;
}

// ── WebRtcTransport factory ─────────────────────────────────────────────────
export async function createWebRtcTransport(router: Router): Promise<WebRtcTransport> {
  return router.createWebRtcTransport({
    listenIps: [{
      ip:          '0.0.0.0',
      announcedIp: announcedIp,
    }],
    enableUdp:  true,
    enableTcp:  true,
    preferUdp:  true,
    initialAvailableOutgoingBitrate: 600_000,
  });
}
