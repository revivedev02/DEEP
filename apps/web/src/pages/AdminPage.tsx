import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Plus, Copy, Check, Trash2, ChevronLeft, RefreshCw, Search, Hash, Mic, Pencil, Settings, Users, Camera } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useServerStore, type Channel } from '@/store/useServerStore';
import ServerIconCropModal from '@/components/ServerIconCropModal';

interface Member {
  id: string; displayName: string; username: string;
  isAdmin: boolean; shortId: string; createdAt: string;
}

// ── Shared copy chip ──────────────────────────────────────────────────────────
function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`inline-flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded transition-all duration-200
        ${copied ? 'bg-status-green/20 text-status-green border border-status-green/30' : 'bg-bg-tertiary text-brand border border-separator hover:border-brand/50'}`}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{text}
    </button>
  );
}

// ── Add user modal ────────────────────────────────────────────────────────────
function AddUserModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Member) => void }) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Member | null>(null);

  const handle = async () => {
    if (!displayName.trim() || !username.trim()) { setError('Both fields are required.'); return; }
    setLoading(true); setError('');
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: displayName.trim(), username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed.'); setLoading(false); return; }
      onAdd(data); setCreated(data);
    } catch { setError('Server error.'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-text-normal">Create Member</h3>
          <p className="text-sm text-text-muted mt-1">A unique Member ID will be generated automatically.</p>
        </div>
        {created ? (
          <div className="modal-body space-y-4 animate-fade-in">
            <div className="rounded-lg bg-status-green/10 border border-status-green/30 p-4 text-center space-y-3">
              <Check className="w-8 h-8 text-status-green mx-auto" />
              <p className="text-sm text-text-normal font-medium"><span className="text-brand">{created.displayName}</span> has been added!</p>
              <p className="text-xs text-text-muted">Share this ID — it's their login key.</p>
              <CopyChip text={created.shortId} />
            </div>
          </div>
        ) : (
          <div className="modal-body space-y-4">
            <div>
              <label className="form-label">Display Name</label>
              <input className="form-input" placeholder="e.g. John Doe" value={displayName}
                onChange={e => { setDisplayName(e.target.value); setError(''); }} autoFocus onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>
            <div>
              <label className="form-label">Username</label>
              <input className="form-input font-mono" placeholder="e.g. johndoe" value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handle()} />
              <p className="form-hint">Lowercase only, no spaces.</p>
            </div>
            {error && <p className="text-sm text-status-red animate-fade-in">{error}</p>}
          </div>
        )}
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">{created ? 'Done' : 'Cancel'}</button>
          {!created && (
            <button onClick={handle} disabled={loading} className="btn-primary">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Generate ID
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────
function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMembers = async () => {
    setLoading(true); setError('');
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      setMembers(await res.json());
    } catch { setError('Could not load members.'); }
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? They will lose access immediately.`)) return;
    const token = useAuthStore.getState().token;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const filtered = members.filter(m =>
    m.displayName.toLowerCase().includes(search.toLowerCase()) ||
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    m.shortId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center gap-3 pb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input className="form-input pl-9 text-sm" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-text-muted">{filtered.length} of {members.length} members</p>
        <button onClick={fetchMembers} className="btn-ghost btn-sm" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={() => setShowModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4" /> Add Member</button>
      </div>
      {error && <div className="px-4 py-3 mb-4 rounded bg-status-red/10 border border-status-red/30 text-status-red text-sm">{error}</div>}
      <table className="admin-table">
        <thead><tr><th>Member</th><th>Username</th><th>Member ID (Login Key)</th><th>Role</th><th>Joined</th><th /></tr></thead>
        <tbody>
          {loading && members.length === 0 ? (
            <tr><td colSpan={6} className="text-center text-text-muted py-12"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Loading…</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={6} className="text-center text-text-muted py-12">No members found.</td></tr>
          ) : filtered.map(m => (
            <tr key={m.id} className="group animate-fade-in">
              <td><div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold">{m.displayName[0].toUpperCase()}</div>
                <span className="font-medium">{m.displayName}</span>
              </div></td>
              <td className="font-mono text-text-muted">#{m.username}</td>
              <td><CopyChip text={m.shortId} /></td>
              <td>{m.isAdmin
                ? <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full font-medium">Admin</span>
                : <span className="text-xs bg-bg-tertiary text-text-muted px-2 py-0.5 rounded-full">Member</span>}
              </td>
              <td className="text-text-muted text-xs">{new Date(m.createdAt).toLocaleDateString()}</td>
              <td>{!m.isAdmin && (
                <button onClick={() => handleDelete(m.id, m.displayName)} className="btn-danger btn-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showModal && <AddUserModal onClose={() => setShowModal(false)} onAdd={m => setMembers(prev => [...prev, m])} />}
    </>
  );
}

// ── Channels tab ──────────────────────────────────────────────────────────────
function ChannelsTab() {
  const { channels, addChannel, updateChannel, removeChannel, setChannels } = useServerStore();
  const [loading, setLoading] = useState(false);
  const [addType, setAddType] = useState<'text' | 'voice' | null>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const token = () => useAuthStore.getState().token;

  useEffect(() => {
    if (channels.length > 0) return;
    fetch('/api/channels', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => Array.isArray(d) && setChannels(d)).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!newName.trim() || !addType) return;
    setLoading(true);
    const res = await fetch('/api/channels', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ name: newName.trim(), type: addType }),
    });
    if (res.ok) { addChannel(await res.json()); setNewName(''); setAddType(null); }
    setLoading(false);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    const res = await fetch(`/api/channels/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) { const d = await res.json(); updateChannel(id, { name: d.name }); }
    setEditingId(null);
  };

  const handleDelete = async (ch: Channel) => {
    if (!confirm(`Delete #${ch.name}? Messages in this channel won't be deleted.`)) return;
    const res = await fetch(`/api/channels/${ch.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) removeChannel(ch.id);
  };

  return (
    <div className="space-y-6">
      {/* Add channel form */}
      <div className="bg-bg-secondary rounded-lg p-4 border border-separator">
        <h3 className="text-sm font-semibold text-text-normal mb-3">Add Channel</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="form-label">Type</label>
            <div className="flex gap-2">
              <button onClick={() => setAddType('text')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-all ${addType === 'text' ? 'border-brand bg-brand/10 text-brand' : 'border-separator text-text-muted hover:border-text-muted'}`}>
                <Hash className="w-3.5 h-3.5" /> Text
              </button>
              <button onClick={() => setAddType('voice')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-all ${addType === 'voice' ? 'border-brand bg-brand/10 text-brand' : 'border-separator text-text-muted hover:border-text-muted'}`}>
                <Mic className="w-3.5 h-3.5" /> Voice
              </button>
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="form-label">Name</label>
            <input className="form-input font-mono" placeholder="channel-name" value={newName}
              onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          </div>
          <button onClick={handleAdd} disabled={loading || !addType || !newName.trim()} className="btn-primary">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
          </button>
        </div>
      </div>

      {/* Channel list */}
      <div className="space-y-1">
        {channels.map(ch => (
          <div key={ch.id} className="group flex items-center gap-3 px-4 py-2.5 rounded-lg bg-bg-secondary border border-separator hover:border-separator/80 transition-all">
            {ch.type === 'voice' ? <Mic className="w-4 h-4 text-text-muted flex-shrink-0" /> : <Hash className="w-4 h-4 text-text-muted flex-shrink-0" />}
            {editingId === ch.id ? (
              <input autoFocus className="flex-1 bg-bg-tertiary rounded px-2 py-0.5 text-sm text-text-normal outline-none border border-brand font-mono"
                value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(ch.id); if (e.key === 'Escape') setEditingId(null); }}
                onBlur={() => handleRename(ch.id)} />
            ) : (
              <span className="flex-1 text-sm text-text-normal font-mono">{ch.name}</span>
            )}
            <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded">{ch.type}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditingId(ch.id); setEditName(ch.name); }} className="btn-ghost btn-sm py-1 px-1.5">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(ch)} className="btn-danger btn-sm py-1 px-1.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  const { serverName, iconUrl, setServerName } = useServerStore();
  const [name, setName]           = useState(serverName);
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);

  useEffect(() => { setName(serverName); }, [serverName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const token = useAuthStore.getState().token;
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ serverName: name.trim() }),
    });
    if (res.ok) { setServerName(name.trim()); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setLoading(false);
  };

  return (
    <div className="max-w-md space-y-6">
      {/* Server Name */}
      <div className="bg-bg-secondary rounded-lg p-5 border border-separator">
        <h3 className="text-sm font-semibold text-text-normal mb-4">Server Name</h3>
        <label className="form-label">Display Name</label>
        <input className="form-input mb-3" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()} maxLength={50} />
        <button onClick={handleSave} disabled={loading || !name.trim()} className={`btn-primary transition-all ${saved ? '!bg-status-green' : ''}`}>
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Server Icon */}
      <div className="bg-bg-secondary rounded-lg p-5 border border-separator">
        <h3 className="text-sm font-semibold text-text-normal mb-4">Server Icon</h3>
        <div className="flex items-center gap-5">
          <div
            className="relative w-20 h-20 rounded-2xl overflow-hidden cursor-pointer group ring-2 ring-separator hover:ring-brand transition-all flex-shrink-0"
            onClick={() => setShowIconModal(true)}
          >
            {iconUrl ? (
              <img src={iconUrl} alt="Server icon" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-brand/20 flex items-center justify-center text-brand/60 text-3xl font-bold select-none">
                {serverName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-text-muted">Click the icon to upload.<br />Crop &amp; zoom before saving.</p>
            <button onClick={() => setShowIconModal(true)} className="btn-primary btn-sm flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Change Icon
            </button>
          </div>
        </div>
      </div>

      {showIconModal && <ServerIconCropModal onClose={() => setShowIconModal(false)} />}
    </div>
  );
}



// ── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'members' | 'channels' | 'settings';

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { serverName } = useServerStore();
  const [tab, setTab] = useState<Tab>('members');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'members',  label: 'Members',  icon: <Users className="w-4 h-4" /> },
    { id: 'channels', label: 'Channels', icon: <Hash className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-separator bg-bg-secondary flex-shrink-0">
        <button onClick={() => navigate('/')} className="btn-ghost btn-sm gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Shield className="w-5 h-5 text-brand" />
          <h1 className="text-lg font-bold text-text-normal">{serverName} — Admin</h1>
        </div>
        <span className="ml-auto text-xs text-text-muted">
          Logged in as <span className="text-brand font-medium">{user?.displayName}</span>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-separator bg-bg-secondary flex-shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-all duration-150 -mb-px border-b-2
              ${tab === t.id ? 'text-text-normal border-brand bg-bg-primary/30' : 'text-text-muted border-transparent hover:text-text-normal hover:border-separator'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 content-transition" key={tab}>
        {tab === 'members'  && <MembersTab />}
        {tab === 'channels' && <ChannelsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
