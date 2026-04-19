/**
 * VoiceBar.tsx
 * Persistent bar at the bottom of the Channel Sidebar.
 * Visible only when connected to a voice channel.
 * Shows: connection status + channel name + quick mute/deafen/leave buttons.
 */
import { Mic, MicOff, Headphones, HeadphonesIcon, PhoneOff } from 'lucide-react';
import { useVoiceStore }   from '@/store/useVoiceStore';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';

export default function VoiceBar() {
  const { channelId, channelName, isMuted, isDeafened } = useVoiceStore();
  const { leaveChannel, setMuted, setDeafened }         = useVoiceChannel();

  // Only render when connected to a channel
  if (!channelId) return null;

  return (
    <div className="voice-bar">
      {/* Status info */}
      <div className="voice-bar-info">
        <div className="voice-bar-status">
          <span className="voice-status-dot" />
          Voice Connected
        </div>
        <div className="voice-bar-channel">#{channelName ?? channelId}</div>
      </div>

      {/* Mute */}
      <button
        className={`voice-bar-btn ${isMuted ? 'muted' : ''}`}
        onClick={() => setMuted(!isMuted)}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted
          ? <MicOff className="w-[18px] h-[18px]" />
          : <Mic    className="w-[18px] h-[18px]" />}
      </button>

      {/* Deafen */}
      <button
        className={`voice-bar-btn ${isDeafened ? 'muted' : ''}`}
        onClick={() => setDeafened(!isDeafened)}
        title={isDeafened ? 'Undeafen' : 'Deafen'}
      >
        {isDeafened
          ? <HeadphonesIcon className="w-[18px] h-[18px]" />
          : <Headphones     className="w-[18px] h-[18px]" />}
      </button>

      {/* Leave */}
      <button
        className="voice-bar-btn"
        onClick={leaveChannel}
        title="Disconnect from voice"
        style={{ color: '#ed4245' }}
      >
        <PhoneOff className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}
