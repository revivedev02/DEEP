import { useNavigate } from 'react-router-dom';
import { Settings, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';

// Server icon — hardcoded single server
function ServerIcon({ active }: { active?: boolean }) {
  return (
    <div className={`rail-icon ${active ? 'active' : ''} group relative`}>
      <span className="text-xl font-bold select-none">P</span>
      <span className="tooltip left-full top-1/2 -translate-y-1/2 ml-3">Private Discord Lite</span>
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1 h-8 bg-white rounded-r-full" />
      )}
    </div>
  );
}

function RailButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`rail-icon group relative ${danger ? 'hover:!bg-status-red' : ''}`}
      title={label}
    >
      {icon}
      <span className="tooltip left-full top-1/2 -translate-y-1/2 ml-3">{label}</span>
    </div>
  );
}

export default function ServerRail() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="server-rail">
      {/* Active server */}
      <ServerIcon active />

      <div className="rail-separator" />

      <div className="flex-1" />

      {/* Admin shortcut */}
      {user?.isAdmin && (
        <RailButton
          icon={<Shield className="w-5 h-5" />}
          label="Admin Panel"
          onClick={() => navigate('/admin')}
        />
      )}

      {/* Settings */}
      <RailButton
        icon={<Settings className="w-5 h-5" />}
        label="Settings (coming soon)"
      />
    </nav>
  );
}
