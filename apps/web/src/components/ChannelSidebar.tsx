import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Settings, Shield, LogOut, Hash, Mic, Plus, Check, X, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { useServerStore, type Channel } from '@/store/useServerStore';
import { SkChannelSidebar } from '@/components/Skeleton';

// ── Inline rename input ───────────────────────────────────────────────────────
function RenameInput({ defaultValue, onSave, onCancel }: { defaultValue: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <input
        autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onSave(val.trim()); if (e.key === 'Escape') onCancel(); }}
        className="flex-1 min-w-0 bg-bg-tertiary rounded px-1.5 py-0.5 text-sm text-text-normal outline-none border border-brand"
        onClick={e => e.stopPropagation()}
      />
      <button onClick={() => val.trim() && onSave(val.trim())} className="text-status-green hover:opacity-80"><Check className="w-3 h-3" /></button>
      <button onClick={onCancel} className="text-status-red hover:opacity-80"><X className="w-3 h-3" /></button>
    </div>
  );
}

// ── Channel row ───────────────────────────────────────────────────────────────
function ChannelItem({ channel, active, isAdmin, onSelect, onRename, onDelete }: {
  channel: Channel; active: boolean; isAdmin: boolean;
  onSelect: () => void; onRename: (n: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const Icon = channel.type === 'voice' ? Mic : Hash;
  return (
    <div
      onClick={() => !editing && onSelect()}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded mx-2 cursor-pointer transition-all duration-150 select-none
        ${active ? 'bg-bg-active text-text-normal' : 'text-text-muted hover:bg-bg-hover hover:text-text-normal'}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
      {editing ? (
        <RenameInput defaultValue={channel.name} onSave={v => { onRename(v); setEditing(false); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <span className="flex-1 text-sm truncate">{channel.name}</span>
          {isAdmin && (
            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={e => { e.stopPropagation(); setEditing(true); }} className="p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-normal">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-0.5 rounded hover:bg-status-red/20 text-text-muted hover:text-status-red">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ── Server name modal ─────────────────────────────────────────────────────────
function ServerNameModal({ current, onClose, onSave }: { current: string; onClose: () => void; onSave: (n: string) => void }) {
  const [val, setVal] = useState(current);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header"><h3 className="text-lg font-bold text-text-normal">Edit Server Name</h3></div>
        <div className="modal-body">
          <label className="form-label">Server Name</label>
          <input autoFocus className="form-input" value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onClose(); }} maxLength={50} />
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={() => val.trim() && onSave(val)} className="btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Add channel modal ─────────────────────────────────────────────────────────
function AddChannelModal({ type, onClose, onAdd }: { type: 'text' | 'voice'; onClose: () => void; onAdd: (ch: Channel) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const handle = async () => {
    if (!name.trim()) { setError('Name required.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error'); setLoading(false); return; }
      onAdd(data);
    } catch { setError('Server error.'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-text-normal">Create {type === 'voice' ? 'Voice' : 'Text'} Channel</h3>
        </div>
        <div className="modal-body">
          <label className="form-label">{type === 'voice' ? <Mic className="w-3 h-3 inline mr-1" /> : <Hash className="w-3 h-3 inline mr-1" />}Channel Name</label>
          <input autoFocus className="form-input font-mono" placeholder="e.g. general"
            value={name} onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handle()} />
          {error && <p className="text-sm text-status-red mt-1">{error}</p>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handle} disabled={loading} className="btn-primary"><Plus className="w-4 h-4" /> Create</button>
        </div>
      </div>
    </div>
  );
}

// ── Section header with optional add button ───────────────────────────────────
function SectionHeader({ label, isAdmin, onAdd }: { label: string; isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="flex items-center px-4 py-1 group">
      <span className="flex-1 text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
      {isAdmin && (
        <button onClick={onAdd} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-normal transition-all">
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ChannelSidebar() {
  const navigate = useNavigate();
  const { user, logout, token } = useAuthStore();
  const { activeChannel, setActiveChannel, showMembers, toggleMembers } = useUIStore();
  const { serverName, channels, isLoading, setServerName, addChannel, updateChannel, removeChannel } = useServerStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [nameModal, setNameModal]       = useState(false);
  const [addModal, setAddModal]         = useState<'text' | 'voice' | null>(null);
  const isAdmin = user?.isAdmin ?? false;

  const textChannels  = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  const handleRename = async (id: string, name: string) => {
    const res = await fetch(`/api/channels/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { const d = await res.json(); updateChannel(id, { name: d.name }); }
  };

  const handleDelete = async (ch: Channel) => {
    if (!confirm(`Delete #${ch.name}?`)) return;
    const res = await fetch(`/api/channels/${ch.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      removeChannel(ch.id);
      if (activeChannel === ch.id) {
        const next = channels.find(c => c.id !== ch.id && c.type === 'text');
        if (next) setActiveChannel(next.id);
      }
    }
  };

  const handleSaveServerName = async (name: string) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ serverName: name }),
    });
    if (res.ok) setServerName(name);
    setNameModal(false);
  };

  return (
    <aside className="channel-sidebar flex flex-col h-full">
      {/* ── Server header ── */}
      <div className="relative">
        <button onClick={() => setDropdownOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-separator hover:bg-bg-hover transition-colors duration-150">
          {isLoading
            ? <div className="skeleton w-24 h-4" />
            : <span className="font-bold text-text-normal truncate">{serverName}</span>}
          <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
            <div className="dropdown-menu absolute top-full left-2 right-2 z-40 animate-fade-in">
              {isAdmin && (
                <>
                  <button className="dropdown-item" onClick={() => { setNameModal(true); setDropdownOpen(false); }}>
                    <Settings className="w-4 h-4" /> Edit Server Name
                  </button>
                  <button className="dropdown-item" onClick={() => { navigate('/admin'); setDropdownOpen(false); }}>
                    <Shield className="w-4 h-4" /> Admin Panel
                  </button>
                  <div className="dropdown-divider" />
                </>
              )}
              <button className="dropdown-item" onClick={toggleMembers}>
                <ChevronRight className="w-4 h-4" /> {showMembers ? 'Hide' : 'Show'} Members
              </button>
              <div className="dropdown-divider" />
              <button className="dropdown-item text-status-red" onClick={() => { logout(); navigate('/login'); }}>
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Channel list ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {isLoading ? (
          <SkChannelSidebar />
        ) : (
          <>
            <SectionHeader label="Text Channels" isAdmin={isAdmin} onAdd={() => setAddModal('text')} />
            {textChannels.map(ch => (
              <ChannelItem key={ch.id} channel={ch} active={activeChannel === ch.id} isAdmin={isAdmin}
                onSelect={() => setActiveChannel(ch.id)} onRename={n => handleRename(ch.id, n)} onDelete={() => handleDelete(ch)} />
            ))}

            <div className="mt-4" />
            <SectionHeader label="Voice Channels" isAdmin={isAdmin} onAdd={() => setAddModal('voice')} />
            {voiceChannels.map(ch => (
              <ChannelItem key={ch.id} channel={ch} active={activeChannel === ch.id} isAdmin={isAdmin}
                onSelect={() => setActiveChannel(ch.id)} onRename={n => handleRename(ch.id, n)} onDelete={() => handleDelete(ch)} />
            ))}
          </>
        )}
      </div>

      {/* ── User footer ── */}
      <div className="px-3 py-2 flex items-center gap-2 border-t border-separator bg-bg-floating">
        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0 select-none">
          {user?.displayName?.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-text-normal truncate">{user?.displayName}</span>
          <span className="text-xs text-text-muted truncate">#{user?.username}</span>
        </div>
      </div>

      {nameModal && <ServerNameModal current={serverName} onClose={() => setNameModal(false)} onSave={handleSaveServerName} />}
      {addModal  && <AddChannelModal type={addModal} onClose={() => setAddModal(null)} onAdd={ch => { addChannel(ch); setAddModal(null); setActiveChannel(ch.id); }} />}
    </aside>
  );
}
