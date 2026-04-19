/**
 * VoicePane.tsx — Discord-style voice channel main panel
 *
 * Tiles fill the entire panel area.
 * Grid adapts to the number of participants.
 * Speaking → green border + glow.
 * Muted/deafened → icon badge on avatar.
 */
import { Mic, MicOff, Headphones, HeadphonesIcon } from 'lucide-react';
import { useVoiceStore }   from '@/store/useVoiceStore';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { LazyAvatar }      from '@/components/LazyAvatar';

interface Props { channelId: string; channelName: string; }

/* ── Grid helpers ── */
function cols(n: number): number {
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
}

function avatarPx(n: number): number {
  if (n <= 1) return 108;
  if (n <= 2) return 92;
  if (n <= 4) return 76;
  if (n <= 6) return 64;
  return 56;
}

export default function VoicePane({ channelId, channelName }: Props) {
  const {
    channelId:    activeChannelId,
    participants,
    isMuted,
    isDeafened,
    isConnecting,
  } = useVoiceStore();

  const { joinChannel, leaveChannel, setMuted, setDeafened } = useVoiceChannel();

  const inThisChannel = activeChannelId === channelId;
  const count         = participants.length;
  const numCols       = cols(count);
  const numRows       = Math.ceil(count / numCols);
  const avPx          = avatarPx(count);

  return (
    <div className="voice-pane-discord">


      <div
        className="voice-tiles-area"
        style={{
          gridTemplateColumns: `repeat(${numCols}, 1fr)`,
          gridTemplateRows:    count > 0 ? `repeat(${numRows}, 1fr)` : '1fr',
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
          participants.map((p) => {
            const speaking = p.isSpeaking && !p.isMuted;
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

      {/* ── Controls ── */}
      {inThisChannel && (
        <div className="voice-controls">
          <button
            className={`voice-control-btn ${isMuted ? 'muted-active' : ''}`}
            onClick={() => setMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="icon-lg" /> : <Mic className="icon-lg" />}
          </button>

          <button
            className={`voice-control-btn ${isDeafened ? 'muted-active' : ''}`}
            onClick={() => setDeafened(!isDeafened)}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened
              ? <HeadphonesIcon className="icon-lg" />
              : <Headphones     className="icon-lg" />}
          </button>

          <button className="voice-control-btn danger" onClick={leaveChannel} title="Leave">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Join prompt ── */}
      {!inThisChannel && !isConnecting && (
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
