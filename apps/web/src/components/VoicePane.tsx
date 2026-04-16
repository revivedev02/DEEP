import { Mic, MicOff, Volume2 } from 'lucide-react';

export default function VoicePane() {
  return (
    <div className="coming-soon-pane animate-fade-in">
      {/* Animated ring + icon */}
      <div className="coming-soon-icon-ring">
        {/* outer pulse rings */}
        <span className="absolute inset-0 rounded-full border-2 border-brand/20 animate-ping" style={{ animationDuration: '2s' }} />
        <span className="absolute inset-2 rounded-full border-2 border-brand/30 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
        <span className="absolute inset-4 rounded-full border-2 border-brand/40 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.6s' }} />

        {/* center icon */}
        <div className="relative z-10 w-20 h-20 rounded-full bg-brand/10 border border-brand/30
                        flex items-center justify-center glow-brand">
          <Volume2 className="w-9 h-9 text-brand" />
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-text-normal">Voice Channel</h2>
        <p className="text-text-muted text-sm max-w-xs">
          Voice chat is coming soon™. We're building a WebRTC mesh so you can
          talk to your crew directly — no server relays.
        </p>
      </div>

      {/* Feature chips */}
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { icon: <Mic className="w-4 h-4" />, label: 'WebRTC P2P' },
          { icon: <Volume2 className="w-4 h-4" />, label: 'Opus Audio' },
          { icon: <MicOff className="w-4 h-4" />, label: 'Mute / Deafen' },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 px-4 py-2 rounded-full
                       bg-bg-secondary border border-separator text-sm text-text-muted"
          >
            {icon}
            {label}
          </div>
        ))}
      </div>

      {/* Progress badge */}
      <div className="flex items-center gap-2 bg-brand/10 border border-brand/30 px-4 py-2 rounded-full">
        <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
        <span className="text-sm text-brand font-medium">In Development</span>
      </div>
    </div>
  );
}
