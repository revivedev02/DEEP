import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Plus, Copy, Check, Trash2, ChevronLeft, RefreshCw, Search } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface Member {
  id: string;
  displayName: string;
  username: string;
  isAdmin: boolean;
  shortId: string;
  createdAt: string;
}

// ── Copy chip ────────────────────────────────────────────────────────────────
function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded
                  transition-all duration-200
                  ${copied
                    ? 'bg-status-green/20 text-status-green border border-status-green/30'
                    : 'bg-bg-tertiary text-brand border border-separator hover:border-brand/50'}`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {text}
    </button>
  );
}

// ── Add user modal ────────────────────────────────────────────────────────────
function AddUserModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Member) => void }) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername]       = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [created, setCreated]         = useState<Member | null>(null);

  const handleCreate = async () => {
    if (!displayName.trim() || !username.trim()) {
      setError('Both fields are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: displayName.trim(), username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create member.');
        setLoading(false);
        return;
      }
      onAdd(data);
      setCreated(data);
    } catch {
      setError('Server error. Is the backend running?');
    }
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
              <p className="text-sm text-text-normal font-medium">
                <span className="text-brand">{created.displayName}</span> has been added!
              </p>
              <p className="text-xs text-text-muted">Share this ID via a secure channel — it's their login key.</p>
              <CopyChip text={created.shortId} />
            </div>
          </div>
        ) : (
          <div className="modal-body space-y-4">
            <div>
              <label className="form-label">Display Name</label>
              <input
                className="form-input"
                placeholder="e.g. John Doe"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label className="form-label">Username</label>
              <input
                className="form-input font-mono"
                placeholder="e.g. johndoe"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <p className="form-hint">Lowercase only, no spaces.</p>
            </div>
            {error && <p className="text-sm text-status-red animate-fade-in">{error}</p>}
          </div>
        )}

        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">{created ? 'Done' : 'Cancel'}</button>
          {!created && (
            <button onClick={handleCreate} disabled={loading} className="btn-primary">
              {loading
                ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                : <Plus className="w-4 h-4" />
              }
              Generate ID
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const { user }  = useAuthStore();
  const [members, setMembers]     = useState<Member[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMembers(await res.json());
    } catch {
      setError('Could not load members. Is the backend running?');
    }
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleAdd    = (m: Member) => setMembers(prev => [...prev, m]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? They will lose access immediately.`)) return;
    try {
      const token = useAuthStore.getState().token;
      await fetch(`/api/admin/users/${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch {
      alert('Failed to delete member.');
    }
  };

  const filtered = members.filter(m =>
    m.displayName.toLowerCase().includes(search.toLowerCase()) ||
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    m.shortId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-separator bg-bg-secondary">
        <button onClick={() => navigate('/')} className="btn-ghost btn-sm gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Shield className="w-5 h-5 text-brand" />
          <h1 className="text-lg font-bold text-text-normal">DEEP — Admin</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-text-muted">
            Logged in as <span className="text-brand font-medium">{user?.displayName}</span>
          </span>
          <button onClick={fetchMembers} className="btn-ghost btn-sm" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" /> Add Member
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-separator">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="form-input pl-9 text-sm"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <p className="text-xs text-text-muted mt-1">{filtered.length} of {members.length} members</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded bg-status-red/10 border border-status-red/30 text-status-red text-sm">
            {error}
          </div>
        )}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Username</th>
              <th>Member ID (Login Key)</th>
              <th>Role</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && members.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-text-muted py-12">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading members…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-text-muted py-12">
                  No members found.
                </td>
              </tr>
            ) : filtered.map(m => (
              <tr key={m.id} className="group animate-fade-in">
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {m.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="font-medium">{m.displayName}</span>
                  </div>
                </td>
                <td className="font-mono text-text-muted">#{m.username}</td>
                <td><CopyChip text={m.shortId} /></td>
                <td>
                  {m.isAdmin
                    ? <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full font-medium">Admin</span>
                    : <span className="text-xs bg-bg-tertiary text-text-muted px-2 py-0.5 rounded-full">Member</span>
                  }
                </td>
                <td className="text-text-muted text-xs">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
                <td>
                  {!m.isAdmin && (
                    <button
                      onClick={() => handleDelete(m.id, m.displayName)}
                      className="btn-danger btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <AddUserModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
    </div>
  );
}
