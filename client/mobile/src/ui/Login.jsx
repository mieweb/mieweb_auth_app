import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiAlertCircle, FiChevronUp } from 'react-icons/fi';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Fingerprint as FingerprintIcon, ShieldCheck, KeyRound } from 'lucide-react';

// ── Lock Screen (biometric auto-trigger) ────────────────────────────────────
const LockScreen = ({ email, onBiometricSuccess, onShowPinFallback, error, isAuthenticating }) => {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-b from-gray-900 via-indigo-950 to-gray-900 text-white select-none px-6 py-10">
      {/* Top – clock */}
      <div className="text-center mt-8 space-y-1">
        <p className="text-6xl font-thin tracking-wide tabular-nums">{time}</p>
        <p className="text-sm font-medium text-indigo-300/80 tracking-wide">{date}</p>
      </div>

      {/* Centre – biometric indicator */}
      <div className="flex flex-col items-center space-y-6 -mt-8">
        {/* Pulsing ring */}
        <div className="relative flex items-center justify-center">
          <span className="absolute h-28 w-28 rounded-full bg-indigo-500/20 animate-ping" />
          <span className="absolute h-24 w-24 rounded-full bg-indigo-500/10" />
          <button
            onClick={onBiometricSuccess}
            disabled={isAuthenticating}
            aria-label="Authenticate with biometrics"
            className="relative z-10 h-20 w-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-transform active:scale-90 hover:bg-white/20"
          >
            {isAuthenticating ? (
              <svg className="animate-spin h-9 w-9 text-indigo-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <FingerprintIcon className="h-9 w-9 text-indigo-300" />
            )}
          </button>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm text-indigo-200/90 font-medium tracking-wide">
            {isAuthenticating ? 'Authenticating…' : 'Tap to unlock with biometrics'}
          </p>
          {email && (
            <p className="text-xs text-indigo-400/70">{email}</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 text-red-200 text-xs px-4 py-2 rounded-xl max-w-xs text-center">
            <FiAlertCircle className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Bottom – swipe hint for PIN fallback */}
      <button
        onClick={onShowPinFallback}
        className="flex flex-col items-center space-y-1 opacity-60 hover:opacity-100 transition-opacity pb-2"
      >
        <FiChevronUp className="h-5 w-5 animate-bounce" />
        <span className="text-xs tracking-wider uppercase">Use PIN instead</span>
      </button>
    </div>
  );
};

// ── Main LoginPage ───────────────────────────────────────────────────────────
export const LoginPage = ({ deviceDetails }) => {
  const [email, setEmail] = useState(() => localStorage.getItem('lastLoggedInEmail') || '');
  const [isReturningUser, setIsReturningUser] = useState(() => !!localStorage.getItem('lastLoggedInEmail'));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false);
  const navigate = useNavigate();
  const biometricTriggered = useRef(false);

  // Determine if biometric credentials exist
  const hasBiometricCredentials = !!localStorage.getItem('biometricUserId');

  // ── Connection monitor ──────────────────────────────────────────────────
  useEffect(() => {
    if (!deviceDetails) console.warn('No device details available');

    const connectionCheck = setInterval(() => {
      if (!Meteor.status().connected) {
        setError('Connection to server lost. Reconnecting…');
      } else if (error.includes('Connection to server lost')) {
        setError('');
      }
    }, 3000);

    return () => clearInterval(connectionCheck);
  }, [deviceDetails, error]);

  // ── Registration check helper ───────────────────────────────────────────
  const checkRegistrationStatus = async (userId, emailAddress) => {
    setCheckingStatus(true);
    try {
      const result = await Meteor.callAsync('users.checkRegistrationStatus', { userId, email: emailAddress });
      if (!result?.status) throw new Error('Failed to retrieve registration status');

      if (result.status !== 'approved') {
        setError('Your account is pending approval by an administrator.');
        navigate('/pending-registration');
        return false;
      }
      return true;
    } catch (err) {
      setError(err.reason || err.message || 'Failed to verify account status');
      return false;
    } finally {
      setCheckingStatus(false);
    }
  };

  // ── Biometric login (reusable) ──────────────────────────────────────────
  const handleBiometricLogin = useCallback(async () => {
    const biometricUserId = localStorage.getItem('biometricUserId');
    if (!biometricUserId) {
      // No credentials stored – fall back to PIN form
      setShowPinForm(true);
      return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      if (!window.Fingerprint) throw new Error('Biometric auth unavailable on this device.');

      await new Promise((resolve, reject) => {
        Fingerprint.loadBiometricSecret(
          { description: 'Authenticate to unlock MieSecure', disableBackup: true },
          async () => {
            try {
              const result = await Meteor.callAsync('users.loginWithBiometric', biometricUserId);
              if (!result?._id) throw new Error('Biometric authentication failed');

              const isApproved = await checkRegistrationStatus(result._id, result.email);
              if (isApproved) {
                Session.set('userProfile', { email: result.email, username: result.username, _id: result._id });
                navigate('/dashboard');
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          (err) => reject(err || new Error('Biometric authentication cancelled'))
        );
      });
    } catch (err) {
      console.error('Biometric login error:', err);
      setError(err.message || 'Biometric login failed. Use PIN instead.');
      // Don't auto-open PIN – let user decide
    } finally {
      setIsLoggingIn(false);
    }
  }, [navigate]);

  // ── Auto-trigger biometrics on mount for returning users ────────────────
  useEffect(() => {
    if (biometricTriggered.current) return;
    if (!hasBiometricCredentials) {
      // No biometrics registered – go straight to PIN form
      setShowPinForm(true);
      return;
    }

    // Small delay so the lock screen renders first
    const timer = setTimeout(() => {
      biometricTriggered.current = true;
      handleBiometricLogin();
    }, 600);

    return () => clearTimeout(timer);
  }, [hasBiometricCredentials, handleBiometricLogin]);

  // ── PIN login ───────────────────────────────────────────────────────────
  const handlePinLogin = async (e) => {
    e.preventDefault();
    if (!deviceDetails) { setError('Device info not available. Please refresh.'); return; }
    if (!Meteor.status().connected) { setError('No connection. Please check your network.'); return; }

    setIsLoggingIn(true);
    setError('');

    try {
      let userId;
      await new Promise((resolve, reject) => {
        Meteor.loginWithPassword(email, pin, (err) => {
          if (err) { reject(err); } else { userId = Meteor.userId(); resolve(); }
        });
      });

      const isApproved = await checkRegistrationStatus(userId, email);
      if (isApproved) {
        Session.set('userProfile', { email, _id: userId });
        localStorage.setItem('lastLoggedInEmail', email);
        navigate('/dashboard');
      } else {
        Meteor.logout();
      }
    } catch (err) {
      setError(err.reason || 'Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ── If biometric credentials exist and we haven't switched to PIN → show lock screen
  if (hasBiometricCredentials && !showPinForm) {
    return (
      <LockScreen
        email={email}
        error={error}
        isAuthenticating={isLoggingIn || checkingStatus}
        onBiometricSuccess={handleBiometricLogin}
        onShowPinFallback={() => { setError(''); setShowPinForm(true); }}
      />
    );
  }

  // ── PIN fallback form ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-50 to-indigo-50">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <KeyRound className="h-7 w-7 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isReturningUser ? 'Welcome Back!' : 'Sign In'}
          </h2>
          <p className="text-sm text-gray-500">
            {isReturningUser ? email : 'Enter your credentials to continue'}
          </p>
        </div>

        <form onSubmit={handlePinLogin} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 p-3 rounded-xl">
              <FiAlertCircle className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <FiMail className="absolute top-3 left-3 text-gray-400" />
              <input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 transition"
                placeholder="Enter your email" autoComplete="email"
                disabled={isLoggingIn || checkingStatus}
              />
            </div>
            {isReturningUser && (
              <button type="button"
                onClick={() => { localStorage.removeItem('lastLoggedInEmail'); setEmail(''); setIsReturningUser(false); }}
                className="text-xs text-indigo-600 hover:underline mt-1"
              >
                Not you? Use a different account
              </button>
            )}
          </div>

          {/* PIN field */}
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
            <div className="relative">
              <FiLock className="absolute top-3 left-3 text-gray-400" />
              <input
                id="pin" type="password" required value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 transition"
                placeholder="Enter your PIN" maxLength={6} minLength={4}
                pattern="[0-9]*" inputMode="numeric" autoComplete="current-password"
                disabled={isLoggingIn || checkingStatus}
              />
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={isLoggingIn || checkingStatus}
            className="w-full py-3 rounded-xl text-white font-medium bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-indigo-200"
          >
            {isLoggingIn || checkingStatus ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {checkingStatus ? 'Verifying…' : 'Signing In…'}
              </span>
            ) : 'Sign In with PIN'}
          </button>
        </form>

        {/* Back to biometric if available */}
        {hasBiometricCredentials && (
          <button
            onClick={() => { setError(''); setShowPinForm(false); biometricTriggered.current = false; }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition"
          >
            <FingerprintIcon className="h-4 w-4" />
            Use Biometrics Instead
          </button>
        )}
      </div>
    </div>
  );
};