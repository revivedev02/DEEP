import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Camera, Check, Copy, User, ChevronRight,
  Loader2, Shield, Palette, ImageIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { LazyAvatar } from '@/components/LazyAvatar';
import AvatarUploadModal from '@/components/AvatarUploadModal';
import BannerUploadModal from '@/components/BannerUploadModal';

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
interface Props { onClose: () => void; }
type Tab = 'account' | 'appearance';

/* ─────────────────────────────────────────────────────────
   Sidebar nav item
───────────────────────────────────────────────────────── */
function NavItem({
  active, icon: Icon, label, onClick,
}: { active: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-left"
      style={{
        background: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--text-normal)' : 'var(--text-muted)',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────── */
export default function AccountSettingsModal({ onClose }: Props) {
  const { user, token, updateDisplayName } = useAuthStore();

  const [tab, setTab]                         = useState<Tab>('account');
  const [showAvatarModal, setShowAvatarModal]  = useState(false);
  const [showBannerModal, setShowBannerModal]  = useState(false);
  const [isClosing, setIsClosing]              = useState(false);

  /* ── Animated close — plays exit animation then calls real onClose ── */
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 210);
  }, [onClose]);

  /* display-name editing */
  const [nameValue,   setNameValue]   = useState(user?.displayName ?? '');
  const [nameEditing, setNameEditing] = useState(false);
  const [nameSaving,  setNameSaving]  = useState(false);
  const [nameError,   setNameError]   = useState('');
  const [nameSaved,   setNameSaved]   = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  /* copy state */
  const [copied, setCopied] = useState(false);

  /* ── close on Esc ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleClose]);

  /* ── focus name input ── */
  useEffect(() => {
    if (nameEditing) requestAnimationFrame(() => nameRef.current?.select());
  }, [nameEditing]);

  /* ── save display name ── */
  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) { setNameError('Name cannot be empty'); return; }
    if (trimmed === user?.displayName) { setNameEditing(false); return; }
    setNameSaving(true); setNameError('');
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) throw new Error();
      const u = await res.json();
      updateDisplayName(u.displayName);
      setNameEditing(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch { setNameError('Failed to save — try again.'); }
    finally { setNameSaving(false); }
  }, [nameValue, user?.displayName, token, updateDisplayName]);

  const handleCopyId = useCallback(() => {
    if (!user?.shortId) return;
    navigator.clipboard.writeText(user.shortId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [user?.shortId]);

  /* ─────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Full-screen backdrop with zoom-out entry ── */}
      <div
        className={`settings-overlay${isClosing ? ' closing' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        {/* ── Sidebar ── */}
        <aside className="settings-sidebar">
          {/* User mini-card at top */}
          <div className="settings-sidebar-user">
            <div className="relative flex-shrink-0">
              <LazyAvatar name={user?.displayName ?? '?'} avatarUrl={user?.avatarUrl} size={8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-normal truncate">{user?.displayName}</p>
              <p className="text-xs text-text-muted truncate">@{user?.username}</p>
            </div>
          </div>

          {/* Nav groups */}
          <div className="mt-4 px-3">
            <p className="settings-nav-label">User Settings</p>
            <div className="flex flex-col gap-0.5">
              <NavItem active={tab === 'account'}    icon={User}    label="My Account"  onClick={() => setTab('account')} />
              <NavItem active={tab === 'appearance'} icon={Palette} label="Appearance"  onClick={() => setTab('appearance')} />
            </div>
          </div>

          {/* Divider */}
          <div className="mx-3 my-3 h-px bg-separator/40" />

          {/* Info */}
          <p className="px-6 text-xs text-text-muted">DEEP v1.0</p>

          {/* Close button at bottom */}
          <button
            onClick={handleClose}
            className="settings-close-btn"
            title="Close Settings (Esc)"
          >
            <X className="w-4 h-4" />
            <span className="text-xs">ESC</span>
          </button>
        </aside>

        {/* ── Main content ── */}
        <main className="settings-main scrollbar-thin">
          <div className="settings-content">

            {/* ═══ MY ACCOUNT TAB ═══ */}
            {tab === 'account' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="settings-page-title">My Account</h1>
                  <p className="settings-page-subtitle">Manage your profile and personal details.</p>
                </div>

                {/* ── Two-column layout ── */}
                <div className="settings-account-grid">

                  {/* LEFT — Profile card */}
                  <div className="flex flex-col gap-4">
                    <div className="settings-profile-card">
                      {/* Banner — clickable */}
                      <div
                        className="settings-profile-banner group cursor-pointer relative"
                        onClick={() => setShowBannerModal(true)}
                        title="Change banner"
                      >
                        {user?.bannerUrl ? (
                          <img
                            src={user.bannerUrl}
                            alt="Profile banner"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-brand/50 via-brand/20 to-transparent" />
                            <div className="absolute inset-0" style={{
                              backgroundImage: 'radial-gradient(circle at 80% 50%, rgb(var(--brand-rgb)/0.3) 0%, transparent 60%)',
                            }} />
                          </>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1">
                            <ImageIcon className="w-5 h-5 text-white" />
                            <span className="text-white text-xs font-medium">Change Banner</span>
                          </div>
                        </div>
                      </div>

                      {/* Avatar */}
                      <div className="px-4 -mt-8 mb-2">
                        <div
                          className="relative group cursor-pointer inline-block"
                          onClick={() => setShowAvatarModal(true)}
                          title="Change avatar"
                        >
                          <div className="ring-4 ring-[var(--card-bg)] rounded-full">
                            <LazyAvatar name={user?.displayName ?? '?'} avatarUrl={user?.avatarUrl} size={16} />
                          </div>
                          <div className="absolute inset-0 rounded-full bg-black/70 flex flex-col items-center justify-center
                                          opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-5 h-5 text-white" />
                            <span className="text-white text-xs mt-0.5 font-medium">Change</span>
                          </div>
                        </div>
                      </div>

                      {/* Name + username */}
                      <div className="px-4 pb-4">
                        <p className="text-lg font-bold text-text-normal">{user?.displayName}</p>
                        <p className="text-sm text-text-muted">@{user?.username}</p>
                        {user?.isAdmin && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                               style={{ background: 'rgb(var(--brand-rgb)/0.15)', color: 'rgb(var(--brand-rgb))' }}>
                            <Shield className="w-3 h-3" /> Admin
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Member ID card */}
                    <div className="settings-profile-card p-4">
                      <p className="settings-section-label mb-2">Member ID</p>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-sm text-text-muted font-mono tracking-wider truncate">{user?.shortId}</code>
                        <button onClick={handleCopyId} className={`settings-btn-secondary flex-shrink-0 flex items-center gap-1.5 ${copied ? 'text-green-400' : ''}`}>
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs text-text-muted mt-2">Share this so friends can DM you.</p>
                    </div>
                  </div>

                  {/* RIGHT — Editable fields */}
                  <div className="flex flex-col gap-5">

                    {/* Display Name */}
                    <section>
                      <h2 className="settings-section-label">Display Name</h2>
                      <div className="settings-field">
                        {nameEditing ? (
                          <div className="flex flex-col gap-3 w-full">
                            <input
                              ref={nameRef}
                              value={nameValue}
                              onChange={e => { setNameValue(e.target.value); setNameError(''); }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveName();
                                if (e.key === 'Escape') { setNameEditing(false); setNameValue(user?.displayName ?? ''); }
                              }}
                              maxLength={32}
                              placeholder="Display name…"
                              className="settings-input"
                            />
                            {nameError && <p className="text-xs text-red-400 -mt-1">{nameError}</p>}
                            <div className="flex gap-2">
                              <button onClick={handleSaveName} disabled={nameSaving} className="settings-btn-primary">
                                {nameSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Save Changes
                              </button>
                              <button
                                onClick={() => { setNameEditing(false); setNameValue(user?.displayName ?? ''); setNameError(''); }}
                                className="settings-btn-ghost"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-text-normal font-medium">{user?.displayName}</p>
                              {nameSaved && <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Saved!</p>}
                            </div>
                            <button
                              onClick={() => { setNameEditing(true); setNameValue(user?.displayName ?? ''); }}
                              className="settings-btn-secondary flex items-center gap-1 flex-shrink-0"
                            >
                              Edit <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </section>

                    {/* Username */}
                    <section>
                      <h2 className="settings-section-label">Username</h2>
                      <div className="settings-field">
                        <p className="text-text-muted font-mono text-sm">@{user?.username}</p>
                        <span className="settings-badge">Read-only</span>
                      </div>
                      <p className="settings-hint">Username cannot be changed.</p>
                    </section>

                    {/* Account info */}
                    <section>
                      <h2 className="settings-section-label">Account</h2>
                      <div className="settings-field flex-col items-start gap-3">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm text-text-muted">Role</span>
                          <span className={`text-sm font-semibold ${user?.isAdmin ? 'text-brand' : 'text-text-normal'}`}>
                            {user?.isAdmin ? 'Administrator' : 'Member'}
                          </span>
                        </div>
                        <div className="w-full h-px bg-separator/30" />
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm text-text-muted">Avatar</span>
                          <button
                            onClick={() => setShowAvatarModal(true)}
                            className="settings-btn-secondary flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5" /> Change Avatar
                          </button>
                        </div>
                        <div className="w-full h-px bg-separator/30" />
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm text-text-muted">Banner</span>
                          <button
                            onClick={() => setShowBannerModal(true)}
                            className="settings-btn-secondary flex items-center gap-1.5"
                          >
                            <ImageIcon className="w-3.5 h-3.5" /> Change Banner
                          </button>
                        </div>
                      </div>
                    </section>

                  </div>
                </div>
              </div>
            )}

            {/* ═══ APPEARANCE TAB ═══ */}
            {tab === 'appearance' && (
              <div className="flex flex-col gap-8">
                <div>
                  <h1 className="settings-page-title">Appearance</h1>
                  <p className="settings-page-subtitle">Customize how DEEP looks for you.</p>
                </div>

                <section>
                  <h2 className="settings-section-label">Theme</h2>
                  <div className="flex items-center gap-4 flex-wrap">
                    {(['oled', 'dark', 'light'] as const).map(t => (
                      <ThemeSwatch key={t} name={t} />
                    ))}
                  </div>
                  <p className="settings-hint mt-3">You can also cycle themes with the theme button in the top header.</p>
                </section>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Avatar upload */}
      {showAvatarModal && (
        <AvatarUploadModal onClose={() => setShowAvatarModal(false)} />
      )}

      {/* Banner upload */}
      {showBannerModal && (
        <BannerUploadModal onClose={() => setShowBannerModal(false)} />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   Theme swatch sub-component
───────────────────────────────────────────────────────── */
import { useThemeStore } from '@/store/useThemeStore';
import type { Theme } from '@/store/useThemeStore';

function ThemeSwatch({ name }: { name: Theme }) {
  const { theme, setTheme } = useThemeStore();
  const active = theme === name;

  const bg:    Record<Theme, string> = { oled: '#000000', dark: '#1b1f2e', light: '#d8dee9' };
  const card:  Record<Theme, string> = { oled: '#131313', dark: '#222639', light: '#ffffff' };
  const label: Record<Theme, string> = { oled: 'OLED Black', dark: 'Navy', light: 'Light' };

  return (
    <button
      onClick={() => setTheme(name)}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150
        ${active ? 'border-brand shadow-[0_0_0_3px_rgb(var(--brand-rgb)/0.2)]' : 'border-separator/40 hover:border-separator'}`}
    >
      {/* Mini preview: canvas with card inside */}
      <div className="w-16 h-10 rounded-lg overflow-hidden" style={{ background: bg[name] }}>
        <div className="m-1.5 rounded h-[calc(100%-12px)]" style={{ background: card[name] }} />
      </div>
      <span className="text-xs font-medium text-text-muted">{label[name]}</span>
      {active && <div className="w-1.5 h-1.5 rounded-full bg-brand" />}
    </button>
  );
}
