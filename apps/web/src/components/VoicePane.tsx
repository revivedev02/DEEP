/**
 * VoicePane.tsx
 * Shows when a voice channel is selected.
 * If not in voice → shows participant list + join prompt.
 * If in voice → shows live participant grid + mute/deafen/leave controls.
 */
import { Mic, MicOff, Headphones, HeadphonesIcon, PhoneOff, Volume2 } from 'lucide-react';
import { useVoiceStore }   from '@/store/useVoiceStore';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { LazyAvatar }      from '@/components/LazyAvatar';

interface Props {
  channelId:   string;
  channelName: string;
}

export default function VoicePane({ channelId, channelName }: Props) {
  const {
    channelId: activeChannelId,
    participants,
    isMuted,
    isDeafened,
    isConnecting,
  } = useVoiceStore();

  const { joinChannel, leaveChannel, setMuted, setDeafened } = useVoiceChannel();

  const inThisChannel = activeChannelId === channelId;

  // Auto-join when this pane mounts (user clicked the voice channel)
  // useEffect is handled in ChatPage — joinChannel is called from there

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
          Voice Connected
        </div>
      )}

      {/* Participant grid */}
      {participants.length > 0 ? (
        <div className="voice-participants-grid">
          {participants.map((p) => (
            <div
              key={p.userId}
              className={`voice-participant-card ${p.isSpeaking && !p.isMuted ? 'is-speaking' : ''}`}
            >
              {/* Avatar with speaking ring */}
              <div className={`voice-avatar-ring ${p.isSpeaking && !p.isMuted ? 'is-speaking' : ''}`}>
                <LazyAvatar
                  name={p.displayName}
                  avatarUrl={p.avatarUrl}
                  size={14}
                />
                {/* Muted badge */}
                {p.isMuted && (
                  <span className="voice-muted-badge">
                    <MicOff className="w-2.5 h-2.5 text-red-400" />
                  </span>
                )}
              </div>
              <span className="voice-participant-name">{p.displayName}</span>
            </div>
          ))}
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
          {/* Mute */}
          <button
            className={`voice-control-btn ${isMuted ? 'muted-active' : ''}`}
            onClick={() => setMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Deafen */}
          <button
            className={`voice-control-btn ${isDeafened ? 'muted-active' : ''}`}
            onClick={() => setDeafened(!isDeafened)}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened
              ? <HeadphonesIcon className="w-4 h-4" />
              : <Headphones className="w-4 h-4" />}
          </button>

          {/* Leave */}
          <button
            className="voice-control-btn danger"
            onClick={leaveChannel}
            title="Disconnect"
          >
            <PhoneOff className="w-4 h-4" />
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
