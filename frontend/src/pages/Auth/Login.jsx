import { useState, useEffect, useRef, useCallback } from 'react';
import { LoaderCircle, Mail, Lock, X, CheckCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import api from '../../lib/api';

const DEPARTMENTS = ['Roads', 'Streetlights', 'Sanitation', 'Water', 'Parks', 'Traffic', 'Other'];

const homeForUser = (user) => {
  if (user?.role === 'super-admin') return '/admin/dashboard';
  if (user?.role === 'sub-admin') return '/authority/dashboard';
  return '/';
};

const emptyLogin = { email: '', password: '' };
const emptyRegister = {
  name: '',
  email: '',
  password: '',
  department: 'Roads',
};

export default function Login() {
  const { login, register, googleLogin, user } = useAuth();
  const navigate = useNavigate();
  const [portal, setPortal] = useState('citizen');
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Forgot Password / OTP modal state ──────────────────────────────────
  const [showForgotModal, setShowForgotModal]   = useState(false);
  const [otpStep, setOtpStep]                   = useState(1); // 1 = email, 2 = otp+password
  const [forgotEmail, setForgotEmail]           = useState('');
  const [otpValue, setOtpValue]                 = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError]           = useState('');
  const [forgotSuccess, setForgotSuccess]       = useState(false);
  const [resendCooldown, setResendCooldown]     = useState(0); // seconds remaining
  const cooldownRef = useRef(null);

  // ── Password visibility toggles ─────────────────────────────────────────
  const [showLoginPassword, setShowLoginPassword]         = useState(false);
  const [showRegisterPassword, setShowRegisterPassword]   = useState(false);
  const [showOtpNewPassword, setShowOtpNewPassword]       = useState(false);
  const [showOtpConfirmPassword, setShowOtpConfirmPassword] = useState(false);

  const isCitizen = portal === 'citizen';

  // Redirect if already authenticated
  if (user) {
    navigate(homeForUser(user));
    return null;
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setSubmitting(true);
    try {
      const nextUser = await googleLogin(credentialResponse.credential);
      navigate(homeForUser(nextUser));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed. Please try again.');
  };

  // ── OTP modal helpers ────────────────────────────────────────────────────
  const startCooldown = useCallback(() => {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  const openForgotModal = () => {
    setForgotEmail(loginForm.email);
    setOtpStep(1);
    setOtpValue('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess(false);
    setResendCooldown(0);
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setShowForgotModal(false);
    setOtpStep(1);
    setOtpValue('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
    setResendCooldown(0);
    setShowOtpNewPassword(false);
    setShowOtpConfirmPassword(false);
  };

  // Step 1 — send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSubmitting(true);
    try {
      await api.post('/auth/forgot-password-otp', { email: forgotEmail, role: portal });
      setOtpStep(2);
      startCooldown();
    } catch (err) {
      setForgotError(err.response?.data?.message || err.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  // Step 2 — resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setForgotError('');
    setForgotSubmitting(true);
    try {
      await api.post('/auth/forgot-password-otp', { email: forgotEmail, role: portal });
      setOtpValue('');
      startCooldown();
    } catch (err) {
      setForgotError(err.response?.data?.message || err.message || 'Failed to resend OTP.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  // Step 2 — verify OTP + set new password
  const handleResetWithOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    setForgotSubmitting(true);
    try {
      await api.post('/auth/reset-password-otp', {
        email: forgotEmail,
        otp: otpValue,
        newPassword,
      });
      setForgotSuccess(true);
      // After 2.5 s auto-close and pre-fill email in the sign-in form
      setTimeout(() => {
        closeForgotModal();
        setLoginForm((prev) => ({ ...prev, email: forgotEmail, password: '' }));
      }, 2500);
    } catch (err) {
      setForgotError(err.response?.data?.message || err.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  // Cleanup interval on unmount
  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const nextUser = await login(
        { email: loginForm.email, password: loginForm.password },
        portal
      );
      navigate(homeForUser(nextUser));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const nextUser = await register({
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
        role: isCitizen ? 'citizen' : 'sub-admin',
        department: isCitizen ? undefined : registerForm.department,
      });
      navigate(homeForUser(nextUser));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md bg-white border border-gray-200 shadow-xl rounded-2xl text-gray-900 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Sign in to JanSamadhan' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {mode === 'login' 
              ? 'Welcome back. Please enter your details.' 
              : 'Join JanSamadhan to report and resolve community issues.'}
          </p>
        </div>

        <div className="mb-6 bg-gray-100 p-1 rounded-xl flex gap-2">
          <button
            type="button"
            onClick={() => setPortal('citizen')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              isCitizen 
                ? 'bg-cyan-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Citizen
          </button>
          <button
            type="button"
            onClick={() => setPortal('authority')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              !isCitizen 
                ? 'bg-cyan-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Authority
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {isCitizen && (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="signin_with"
                  shape="rectangular"
                  theme="outline"
                  size="large"
                  width="368"
                />
              </div>
            )}

            {isCitizen && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">or</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 tracking-wider uppercase">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={openForgotModal}
                    className="text-xs font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    minLength={8}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-10 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 transition disabled:opacity-70"
            >
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {isCitizen && (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="signup_with"
                  shape="rectangular"
                  theme="outline"
                  size="large"
                  width="368"
                />
              </div>
            )}

            {isCitizen && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">or</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 px-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Ada Lovelace"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-10 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {!isCitizen && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                    Department
                  </label>
                  <select
                    value={registerForm.department}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 py-3 px-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 transition disabled:opacity-70"
            >
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Create account
            </button>
          </form>
        )}

        {isCitizen && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode((prev) => (prev === 'login' ? 'register' : 'login'));
                }}
                className="font-semibold text-cyan-600 hover:text-cyan-700"
              >
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>
        )}
        {!isCitizen && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Authorities cannot self-register. Please contact the Super Admin for access.
            </p>
          </div>
        )}
      </div>

      {/* ── Forgot Password / OTP Modal ── */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeForgotModal(); }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 relative">

            {/* Close button */}
            <button
              type="button"
              onClick={closeForgotModal}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Step indicator */}
            {!forgotSuccess && (
              <div className="flex items-center gap-2 mb-5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                  otpStep >= 1 ? 'bg-cyan-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>1</div>
                <div className={`h-px flex-1 transition ${otpStep === 2 ? 'bg-cyan-600' : 'bg-gray-200'}`} />
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                  otpStep === 2 ? 'bg-cyan-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>2</div>
              </div>
            )}

            {/* ── SUCCESS STATE ── */}
            {forgotSuccess ? (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <h2 className="text-lg font-bold text-gray-900">Password updated!</h2>
                <p className="text-sm text-gray-500">
                  Your password has been reset. Redirecting you to sign in…
                </p>
              </div>

            /* ── STEP 1: Enter email ── */
            ) : otpStep === 1 ? (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-900">Reset your password</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    We'll send a 6-digit OTP to your{' '}
                    <span className="font-medium text-gray-700">
                      {portal === 'citizen' ? 'Citizen' : 'Authority'}
                    </span>{' '}
                    account email.
                  </p>
                </div>

                {forgotError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {forgotError}
                  </div>
                )}

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 transition disabled:opacity-70"
                  >
                    {forgotSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Send OTP
                  </button>
                </form>
              </>

            /* ── STEP 2: Enter OTP + new password ── */
            ) : (
              <>
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="h-5 w-5 text-cyan-600" />
                    <h2 className="text-lg font-bold text-gray-900">Verify &amp; reset</h2>
                  </div>
                  <p className="text-sm text-gray-500">
                    Enter the 6-digit code sent to <span className="font-medium text-gray-700">{forgotEmail}</span>.
                  </p>
                </div>

                {forgotError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {forgotError}
                  </div>
                )}

                <form onSubmit={handleResetWithOtp} className="space-y-4">
                  {/* OTP input */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                      OTP Code
                    </label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      maxLength={6}
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 px-4 text-center text-xl font-mono tracking-widest outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      placeholder="••••••"
                    />
                  </div>

                  {/* New password */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showOtpNewPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-10 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOtpNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        aria-label={showOtpNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showOtpNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700 tracking-wider uppercase">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showOtpConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 py-3 pl-10 pr-10 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        placeholder="Repeat your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOtpConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        aria-label={showOtpConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showOtpConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotSubmitting || otpValue.length < 6}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 transition disabled:opacity-70"
                  >
                    {forgotSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Reset Password
                  </button>
                </form>

                {/* Resend OTP */}
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500">
                    Didn't receive the code?{' '}
                    {resendCooldown > 0 ? (
                      <span className="font-medium text-gray-400">
                        Resend in {resendCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={forgotSubmitting}
                        className="font-semibold text-cyan-600 hover:text-cyan-700 hover:underline disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    )}
                  </p>
                </div>

                {/* Back to step 1 */}
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => { setOtpStep(1); setForgotError(''); setOtpValue(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                  >
                    ← Use a different email
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
