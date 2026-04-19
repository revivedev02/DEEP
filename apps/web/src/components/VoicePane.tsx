/**
 * VoicePane.tsx — Discord-style voice channel main panel
 *
 * Layouts:
 *   • TILE GRID   — default, fills entire pane; scales with participant count
 *   • SCREEN SHARE — video takes main area; participant tiles strip at bottom
 *
 * Speaking → green border + glow.
 * Muted/deafened → icon badge on avatar.
 */
import { useEffect, useRef } from 'react';
import { Mic, MicOff, Headphones, HeadphonesIcon, MonitorOff } from 'lucide-react';
import { useVoiceStore }   from '@/store/useVoiceStore';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { LazyAvatar }      from '@/components/LazyAvatar';

// Grid sizing helpers
function getGridCols(count: number) {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}
function getAvatarPx(count: number) {
  if (count <= 1) return 140;
  if (count <= 4) return 100;
  if (count <= 6) return 80;
  return 64;
}

interface VoicePaneProps {
  channelId:   string;
  channelName: string;
}

export default function VoicePane({ channelId, channelName }: VoicePaneProps) {
  const {
    participants, isMuted, isDeafened,
    channelId: connectedId, isConnecting,
    isScreenSharing, screenShareStream, screenShareOwner,
  } = useVoiceStore();

  const { joinChannel, leaveChannel, setMuted, setDeafened, stopScreenShare } = useVoiceChannel();

  const inThisChannel = connectedId === channelId;
  const count         = participants.length;

  // ── Screen share video ref ─────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = screenShareStream ?? null;
    }
  }, [screenShareStream]);

  const cols  = getGridCols(count);
  const avPx  = getAvatarPx(count);

  return (
    <div className="voice-pane-discord">

      {/* ── SCREEN SHARE LAYOUT ─────────────────────────────────────────── */}
      {screenShareStream ? (
        <div className="voice-screenshare-layout">

          {/* Big video */}
          <div className="voice-screenshare-container">
            <div className="voice-screenshare-label">
              <MonitorOff className="icon-sm" />
              {screenShareOwner ?? 'Someone'} is sharing their screen
              {isScreenSharing && (
                <button
                  className="voice-screenshare-stop-btn"
                  onClick={stopScreenShare}
                >
                  Stop sharing
                </button>
              )}
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="voice-screenshare-video"
            />
          </div>

          {/* Participant strip at bottom */}
          <div className="voice-screenshare-participants">
            {participants.map(p => {
              const speaking = p.isSpeaking && !isMuted;
              return (
                <div key={p.userId} className={`voice-tile-mini ${speaking ? 'is-speaking' : ''}`}>
                  <LazyAvatar name={p.displayName} avatarUrl={p.avatarUrl} size={9} />
                  {p.isMuted && (
                    <div className="voice-tile-muted-badge">
                      <MicOff className="icon-xs" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      ) : (
        /* ── TILE GRID LAYOUT ────────────────────────────────────────────── */
        <div
          className="voice-tiles-area"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
          }}
        >
          {count === 0 ? (
            <div className="voice-empty">
              <Mic className="icon-xl text-text-muted opacity-40" />
              <span className="voice-empty-text">
                {isConnecting ? 'Connecting…' : 'No one is here yet.'}
              </span>
            </div>
          ) : (
            participants.map(p => {
              const speaking = p.isSpeaking && !isMuted;
              return (
                <div
                  key={p.userId}
                  className={`voice-tile ${speaking ? 'is-speaking' : ''}`}
                >
                  {/* Avatar only — speaking ring handled by CSS */}
                  <div
                    className="voice-tile-avatar"
                    style={{ width: avPx, height: avPx }}
                  >
                    <LazyAvatar
                      name={p.displayName}
                      avatarUrl={p.avatarUrl}
                      size={Math.round(avPx / 4)}
                    />
                    {/* Muted badge — only indicator needed */}
                    {p.isMuted && (
                      <div className="voice-tile-muted-badge">
                        <MicOff className="icon-xs" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Controls bar ────────────────────────────────────────────────── */}
      {inThisChannel && (
        <div className="voice-controls">
          {/* Mute */}
          <button
            className={`voice-control-btn ${isMuted ? 'muted-active' : ''}`}
            onClick={() => setMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="icon-lg" /> : <Mic className="icon-lg" />}
          </button>

          {/* Deafen */}
          <button
            className={`voice-control-btn ${isDeafened ? 'muted-active' : ''}`}
            onClick={() => setDeafened(!isDeafened)}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened
              ? <HeadphonesIcon className="icon-lg" />
              : <Headphones     className="icon-lg" />}
          </button>

          {/* Leave */}
          <button className="voice-control-btn danger" onClick={leaveChannel} title="Leave">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Join prompt (if not connected) ──────────────────────────────── */}
      {!inThisChannel && (
        <button
          className="profile-card-msg-btn w-full justify-center mt-auto"
          onClick={() => joinChannel(channelId, channelName)}
        >
          <Mic className="icon-md" /> Join Voice
        </button>
      )}
    </div>
  );
}
