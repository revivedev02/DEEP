/**
 * VoicePane.tsx
 * Discord-style voice channel view.
 * - Cards scale based on member count (fewer = bigger)
 * - Avatar + name + mic/speaker status icons
 */
import { Mic, MicOff, Volume2, Headphones } from 'lucide-react';
import { useVoiceStore }   from '@/store/useVoiceStore';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { LazyAvatar }      from '@/components/LazyAvatar';

interface Props {
  channelId:   string;
  channelName: string;
}

/** Compute a responsive grid based on how many people are in the channel */
function gridStyle(count: number): React.CSSProperties {
  if (count === 0) return {};
  if (count === 1)  return { gridTemplateColumns: '1fr' };
  if (count === 2)  return { gridTemplateColumns: 'repeat(2, 1fr)' };
  if (count <= 4)   return { gridTemplateColumns: 'repeat(2, 1fr)' };
  if (count <= 9)   return { gridTemplateColumns: 'repeat(3, 1fr)' };
  return { gridTemplateColumns: 'repeat(4, 1fr)' };
}

/** Avatar size token (Tailwind size unit) based on member count */
function avatarSize(count: number): number {
  if (count === 1)  return 24;  // 96px — full emphasis
  if (count === 2)  return 20;  // 80px
  if (count <= 4)   return 16;  // 64px
  if (count <= 9)   return 14;  // 56px
  return 12;                    // 48px
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

  return (
    <div className="voice-pane animate-fade-in">

      {/* Header */}
      <div className="voice-pane-header">
        <Volume2 className="w-5 h-5 text-text-muted" />
        #{channelName}
      </div>

      {/* Connected status */}
      {inThisChannel && (
        <div className="voice-pane-status">
          <span className="voice-status-dot" />
          Voice Connected · {count} {count === 1 ? 'member' : 'members'}
        </div>
      )}

      {/* Participant grid */}
      {count > 0 ? (
        <div className="voice-participants-grid" style={gridStyle(count)}>
          {participants.map((p) => {
            const speaking = p.isSpeaking && !p.isMuted;
            return (
              <div
                key={p.userId}
                className={`voice-participant-card ${speaking ? 'is-speaking' : ''}`}
              >
                {/* Avatar with speaking ring */}
                <div className={`voice-avatar-ring ${speaking ? 'is-speaking' : ''}`}>
                  <LazyAvatar
                    name={p.displayName}
                    avatarUrl={p.avatarUrl}
                    size={avatarSize(count)}
                  />
                </div>

                {/* Name + status icons */}
                <div className="voice-participant-footer">
                  <span className="voice-participant-name">{p.displayName}</span>
                  <div className="voice-participant-status-icons">
                    {p.isMuted
                      ? <MicOff className="voice-status-icon muted"  />
                      : <Mic     className="voice-status-icon active" />}
                    {/* Show deafen state only for the local user */}
                    {p.userId === useVoiceStore.getState().participants[0]?.userId && isDeafened && (
                      <Headphones className="voice-status-icon muted" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="voice-empty">
          <span className="voice-empty-text">
            {isConnecting ? 'Connecting…' : 'No one is in this channel yet.'}
          </span>
        </div>
      )}

      {/* Controls — only when connected to THIS channel */}
      {inThisChannel && (
        <div className="voice-controls">
          <button
            className={`voice-control-btn ${isMuted ? 'muted-active' : ''}`}
            onClick={() => setMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            className={`voice-control-btn ${isDeafened ? 'muted-active' : ''}`}
            onClick={() => setDeafened(!isDeafened)}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <Headphones className="w-5 h-5" />
          </button>

          <button
            className="voice-control-btn danger"
            onClick={leaveChannel}
            title="Disconnect"
          >
            {/* Phone hang-up SVG inline so we don't need an extra import */}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
          </button>
        </div>
      )}

      {/* Join prompt if not connected */}
      {!inThisChannel && !isConnecting && (
        <button
          className="profile-card-msg-btn w-full justify-center"
          onClick={() => joinChannel(channelId, channelName)}
        >
          <Volume2 className="w-4 h-4" />
          Join Voice
        </button>
      )}
    </div>
  );
}
