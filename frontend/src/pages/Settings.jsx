import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Trash2,
  LoaderCircle,
  CheckCircle,
  Camera,
  LogOut,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../lib/api';

// ── Reusable section card ────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Icon className="h-5 w-5 text-cyan-600" />
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
    </div>
  );
}

// ── Password input with eye toggle ──────────────────────────────────────────
function PasswordField({ label, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type={show ? 'text' : 'password'}
          required
          minLength={8}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-10 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

// ── Inline feedback banner ───────────────────────────────────────────────────
function Feedback({ type, message }) {
  if (!message) return null;
  const styles =
    type === 'success'
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-red-50 border-red-200 text-red-700';
  return (
    <div className={`mt-3 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${styles}`}>
      {type === 'success' && <CheckCircle className="h-4 w-4 shrink-0" />}
      {message}
    </div>
  );
}

// ============================================================================
export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { lang, changeLanguage, t } = useLanguage();
  const navigate = useNavigate();

  // ── Profile state ──────────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null); // { type, message }
  const avatarInputRef = useRef(null);

  // ── Password state ─────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);

  // ── Danger zone state ──────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileFeedback(null);
    setProfileSaving(true);
    try {
      const { data } = await api.put('/users/profile', {
        name,
        avatarUrl: avatarPreview,
      });
      updateUser(data.user);
      setProfileFeedback({ type: 'success', message: 'Profile updated successfully.' });
    } catch (err) {
      setProfileFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to update profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordFeedback(null);
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    setPasswordSaving(true);
    try {
      await api.put('/users/change-password', { currentPassword, newPassword });
      setPasswordFeedback({ type: 'success', message: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to change password.',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteFeedback(null);
    setDeleting(true);
    try {
      await api.delete('/users/account');
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    } catch (err) {
      setDeleteFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to delete account.',
      });
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
      navigate('/login');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">{t.settings}</h1>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <Card>
        <SectionHeading icon={User} title={t.profile} />
        <form onSubmit={handleProfileSave} className="space-y-5" lang={lang}>

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-full bg-brand-100 overflow-hidden flex items-center justify-center text-2xl font-bold text-brand-700">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  (user?.name?.[0] || 'U').toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-white shadow hover:bg-cyan-700 transition"
                aria-label="Change profile picture"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{t.avatar}</p>
              <p className="text-xs text-gray-500 mt-0.5">JPG, PNG or GIF · max 2 MB</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
              {t.fullName}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder={t.placeholderFullName}
              />
            </div>
          </div>

          {/* Email — read only */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
              {t.email}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                readOnly
                value={user?.email || ''}
                className="w-full rounded-lg bg-gray-100 border border-gray-200 text-gray-500 py-3 pl-10 pr-4 text-sm outline-none cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed.</p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 transition disabled:opacity-70"
            >
              {profileSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t.saveChanges}
            </button>
          </div>
          <Feedback {...(profileFeedback || {})} message={profileFeedback?.message} />
        </form>
      </Card>

      {/* ── Preferences ──────────────────────────────────────────────────── */}
      <Card>
        <SectionHeading icon={Globe} title={t.preferences} />
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
            {t.languageLabel}
          </label>
          <select
            value={lang}
            onChange={(e) => changeLanguage(e.target.value)}
            className="w-full max-w-xs rounded-lg bg-gray-50 border border-gray-300 text-gray-900 py-3 px-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </select>
        </div>
      </Card>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <Card>
        <SectionHeading icon={Lock} title={t.security} />
        {user?.googleId && !user?.password ? (
          <p className="text-sm text-gray-500">
            Your account uses Google sign-in. Password change is not available.
          </p>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4" lang={lang}>
            <PasswordField
              label={t.currentPassword}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t.placeholderCurrentPassword}
            />
            <PasswordField
              label={t.newPassword}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t.placeholderNewPassword}
            />
            <PasswordField
              label={t.confirmPassword}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t.placeholderConfirmPassword}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 transition disabled:opacity-70"
              >
                {passwordSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t.changePassword}
              </button>
            </div>
            <Feedback {...(passwordFeedback || {})} message={passwordFeedback?.message} />
          </form>
        )}
      </Card>

      {/* ── Account Session / Logout ──────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-red-600">
          <div className="p-2 bg-red-50 rounded-xl">
            <ShieldAlert className="w-5 h-5"/>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Account Session</h3>
            <p className="text-xs text-slate-500 font-medium">Manage your active session on this device</p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-between items-center flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-700">Log Out of JanSamadhan</p>
            <p className="text-[11px] text-slate-400">You will need to sign in again to submit or track reports.</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-2xl transition-all flex items-center gap-2 border border-red-200/60 active:scale-95"
          >
            <LogOut className="w-4 h-4"/>
            Log Out
          </button>
        </div>
      </div>

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="h-5 w-5 text-red-600" />
          <h2 className="text-base font-bold text-red-700">{t.dangerZone}</h2>
        </div>
        <p className="text-sm text-red-600 mb-4">
          Permanently deletes your account and all associated data. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteFeedback(null); }}
          className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition"
        >
          {t.deleteAccount}
        </button>
      </div>

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-bold text-gray-900">{t.deleteAccount}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This will permanently delete your account and cannot be reversed. To continue, type{' '}
              <span className="font-mono font-bold text-red-600">DELETE</span> below.
            </p>

            <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
              {t.confirmDelete}
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-2.5 px-4 text-sm font-mono outline-none focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4"
              placeholder="DELETE"
              autoComplete="off"
            />

            {deleteFeedback && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deleteFeedback.message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                onClick={handleDeleteAccount}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
