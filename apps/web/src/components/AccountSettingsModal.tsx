import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Check, Copy, User, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { LazyAvatar } from '@/components/LazyAvatar';
import AvatarUploadModal from '@/components/AvatarUploadModal';

interface Props { onClose: () => void; }

type Tab = 'account';

export default function AccountSettingsModal({ onClose }: Props) {
  const { user, token, updateDisplayName } = useAuthStore();
  const [tab] = useState<Tab>('account');
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Display name edit
  const [nameValue, setNameValue]   = useState(user?.displayName ?? '');
  const [nameEditing, setNameEditing] = useState(false);
  const [nameSaving, setNameSaving]  = useState(false);
  const [nameError, setNameError]    = useState('');
  const [nameSaved, setNameSaved]    = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Copy tag state
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Focus name input when editing
  useEffect(() => {
    if (nameEditing) nameRef.current?.focus();
  }, [nameEditing]);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) { setNameError('Name cannot be empty'); return; }
    if (trimmed === user?.displayName) { setNameEditing(false); return; }
    setNameSaving(true);
    setNameError('');
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      updateDisplayName(updated.displayName);
      setNameEditing(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch {
      setNameError('Failed to save. Try again.');
    } finally {
      setNameSaving(false);
    }
  }, [nameValue, user?.displayName, token, updateDisplayName]);

  const handleCopyId = useCallback(() => {
    if (!user?.shortId) return;
    navigator.clipboard.writeText(user.shortId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [user?.shortId]);

  const TABS = [
    { id: 'account' as Tab, label: 'My Account', icon: User },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.7)] animate-scale-in"
        style={{ background: 'var(--bg-secondary)', maxHeight: '90vh' }}
      >
        {/* ── Left nav ─────────────────────────────────────────────────────── */}
        <nav
          className="flex flex-col gap-1 p-4 flex-shrink-0"
          style={{ width: 200, background: 'var(--bg-tertiary)', borderRight: '1px solid rgb(var(--separator-rgb)/0.3)' }}
        >
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest px-3 mb-2">User Settings</p>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                tab === id
                  ? 'bg-white/10 text-text-normal'
                  : 'text-text-muted hover:bg-white/5 hover:text-text-normal'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}

          <div className="mt-auto pt-4 border-t border-separator/30" />
        </nav>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-8">

          {/* Avatar overlay section */}
          {tab === 'account' && (
            <div className="flex flex-col gap-7">

              {/* Profile card */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg-primary)', border: '1px solid rgb(var(--separator-rgb)/0.3)' }}
              >
                {/* Banner */}
                <div className="h-20 bg-gradient-to-r from-brand/40 to-brand/20" />

                {/* Avatar + info */}
                <div className="px-5 pb-5">
                  <div className="flex items-end justify-between -mt-10 mb-4">
                    <div className="relative group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
                      <div className="ring-4 rounded-full" style={{ ringColor: 'var(--bg-primary)' }}>
                        <LazyAvatar name={user?.displayName ?? '?'} avatarUrl={user?.avatarUrl} size={20} />
                      </div>
                      <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-center">
                        <Camera className="w-5 h-5 mb-0.5" />
                        <span className="text-xs font-medium leading-none">Change</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setNameEditing(true)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'var(--bg-hover)', color: 'var(--tw-text-text-normal)' }}
                    >
                      Edit Profile
                    </button>
                  </div>
                  <p className="font-bold text-lg text-text-normal">{user?.displayName}</p>
                  <p className="text-sm text-text-muted">@{user?.username}</p>
                </div>
              </div>

              {/* Display Name */}
              <section>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Display Name</h3>
                <div
                  className="rounded-xl p-4 flex items-center justify-between gap-4"
                  style={{ background: 'var(--bg-primary)', border: '1px solid rgb(var(--separator-rgb)/0.3)' }}
                >
                  {nameEditing ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <input
                        ref={nameRef}
                        value={nameValue}
                        onChange={e => { setNameValue(e.target.value); setNameError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setNameEditing(false); setNameValue(user?.displayName ?? ''); } }}
                        maxLength={32}
                        className="w-full bg-transparent text-text-normal text-sm outline-none border-b border-brand/60 pb-1 focus:border-brand"
                        placeholder="Enter display name…"
                      />
                      {nameError && <p className="text-xs text-status-red">{nameError}</p>}
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={handleSaveName} disabled={nameSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-60"
                          style={{ background: 'rgb(var(--brand-rgb))' }}
                        >
                          {nameSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Save
                        </button>
                        <button
                          onClick={() => { setNameEditing(false); setNameValue(user?.displayName ?? ''); setNameError(''); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-normal transition-colors"
                          style={{ background: 'var(--bg-hover)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-text-normal text-sm font-medium">{user?.displayName}</p>
                        {nameSaved && <p className="text-xs text-green-400 mt-0.5">✓ Saved successfully</p>}
                      </div>
                      <button
                        onClick={() => { setNameEditing(true); setNameValue(user?.displayName ?? ''); }}
                        className="text-xs px-3 py-1.5 rounded-lg text-text-muted hover:text-text-normal transition-colors font-medium flex items-center gap-1"
                        style={{ background: 'var(--bg-hover)' }}
                      >
                        Edit
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </section>

              {/* Username (read-only) */}
              <section>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Username</h3>
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'var(--bg-primary)', border: '1px solid rgb(var(--separator-rgb)/0.3)' }}
                >
                  <p className="text-text-muted text-sm">@{user?.username}</p>
                </div>
              </section>

              {/* Member ID */}
              <section>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Member ID</h3>
                <div
                  className="rounded-xl p-4 flex items-center justify-between gap-4"
                  style={{ background: 'var(--bg-primary)', border: '1px solid rgb(var(--separator-rgb)/0.3)' }}
                >
                  <code className="text-sm text-text-muted font-mono tracking-wide">{user?.shortId}</code>
                  <button
                    onClick={handleCopyId}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ background: 'var(--bg-hover)', color: copied ? '#4ade80' : 'var(--text-muted)' }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-2 px-1">
                  Share this ID with others so they can find you on DEEP.
                </p>
              </section>

            </div>
          )}

          {/* Avatar tab */}
          {tab === 'account' && showAvatarModal && null /* handled by modal below */}

        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-normal hover:bg-white/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Avatar upload modal — stacks on top */}
      {showAvatarModal && (
        <AvatarUploadModal onClose={() => setShowAvatarModal(false)} />
      )}
    </div>
  );
}
