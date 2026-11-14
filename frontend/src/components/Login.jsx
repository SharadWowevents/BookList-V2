import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { authAPI, setToken, adminAPI } from '../services/api';
import { EyeIcon, MailIcon, CheckIcon, BackIcon, KeyIcon, XIcon } from './Icons';

async function sha256(str) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0;
    for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0;
    return "h" + h;
  }
}

export const Login = () => {
  const { setSession, showToast, pendingShareSid, navigate, openPrivacyPolicy } = useApp();

  const handlePostLoginNavigation = (user) => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect && redirect.startsWith('/') && redirect !== '/login' && redirect !== '/') {
      navigate(redirect, { replace: true });
    } else {
      navigate('/' + (user?.tab || 'notes'), { replace: true });
    }
  };

  const [mode, setMode] = useState('local');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requireLogin, setRequireLogin] = useState(false);

  // Contact Admin Reset Query State
  const [showContactAdmin, setShowContactAdmin] = useState(false);
  const [adminReqType, setAdminReqType] = useState('pin'); // 'pin' | 'password'
  const [adminReqName, setAdminReqName] = useState('');
  const [adminReqEmail, setAdminReqEmail] = useState('');
  const [adminReqNote, setAdminReqNote] = useState('');
  const [adminReqSubmitting, setAdminReqSubmitting] = useState(false);
  const [adminReqSuccess, setAdminReqSuccess] = useState(false);
  const [adminReqError, setAdminReqError] = useState('');

  const handleOpenContactAdmin = (type = 'pin') => {
    setAdminReqType(type);
    setAdminReqName(type === 'pin' ? (name.trim() || '') : (username.trim() || ''));
    setAdminReqEmail('');
    setAdminReqNote('');
    setAdminReqError('');
    setAdminReqSuccess(false);
    setShowContactAdmin(true);
  };

  const handleSubmitContactAdmin = async (e) => {
    e.preventDefault();
    setAdminReqError('');
    const trimmedName = adminReqName.trim();
    const trimmedEmail = adminReqEmail.trim().toLowerCase();

    if (!trimmedName) {
      setAdminReqError(adminReqType === 'pin' ? 'Please enter your name.' : 'Please enter your username.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAdminReqError('Please enter a valid email address.');
      return;
    }

    setAdminReqSubmitting(true);
    try {
      await authAPI.submitResetRequest({
        identifier: trimmedName,
        email: trimmedEmail,
        type: adminReqType,
        note: adminReqNote.trim()
      });
      setAdminReqSuccess(true);
    } catch (err) {
      setAdminReqError(err.message || 'Error submitting query to administrator.');
    } finally {
      setAdminReqSubmitting(false);
    }
  };

  // Forgot password & PIN OTP verification state
  const [forgotStep, setForgotStep] = useState(1); // 1: identifier, 2: otp & new credentials, 3: success
  const [forgotType, setForgotType] = useState('password'); // 'password' | 'pin'
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotTargetUser, setForgotTargetUser] = useState('');
  const [forgotTargetName, setForgotTargetName] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // Check if system requires team login
  useEffect(() => {
    adminAPI.getConfig().then(cfg => {
      if (cfg && cfg.requireLogin) {
        setRequireLogin(true);
        setMode('team');
      }
    }).catch(() => {});
  }, []);

  const handleLocalSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedPin = pin.trim();

    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }
    if (!/^\d{4}$/.test(trimmedPin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    setLoading(true);

    try {
      // Attempt backend sign-in
      const res = await authAPI.pinLogin(trimmedName, trimmedPin);
      if (res && res.token && res.user) {
        setToken(res.token);
        setSession(res.user);
        showToast(`Welcome back, ${res.user.name}!`);
        handlePostLoginNavigation(res.user);
        return;
      }
    } catch (err) {
      if (err.status === 400 || err.status === 403) {
        setError(err.message);
        setLoading(false);
        return;
      }
      // If network error (offline), fallback to local storage authentication
      const key = trimmedName.toLowerCase();
      const hash = await sha256(key + ":" + trimmedPin);

      let accounts = {};
      try {
        accounts = JSON.parse(localStorage.getItem('listbook:accounts')) || {};
      } catch {}

      if (accounts[key] && accounts[key] !== hash) {
        setError("That PIN doesn't match this name. Try again.");
        setLoading(false);
        return;
      }

      if (!accounts[key]) {
        accounts[key] = hash;
        try {
          localStorage.setItem('listbook:accounts', JSON.stringify(accounts));
        } catch {}
      }

      const localUser = { mode: 'local', key, name: trimmedName };
      setSession(localUser);
      handlePostLoginNavigation(localUser);
    }
    setLoading(false);
  };

  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const u = username.trim().toLowerCase();
    const pw = password;

    if (!u || !pw) {
      setError('Enter your username and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await authAPI.teamLogin(u, pw);
      if (res && res.token && res.user) {
        setToken(res.token);
        setSession(res.user);
        showToast(`Signed in as ${res.user.name}.`);
        handlePostLoginNavigation(res.user);
      }
    } catch (err) {
      setError(err.message || "That username and password don't match.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setForgotError('');
    const id = forgotIdentifier.trim();
    if (!id) {
      setForgotError(forgotType === 'pin' ? 'Please enter your name or registered email.' : 'Please enter your username or registered email.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authAPI.requestPasswordResetOtp(id);
      setForgotTargetUser(res.username);
      setForgotTargetName(res.name || res.username);
      if (res.authType) {
        setForgotType(res.authType);
      }
      setForgotMaskedEmail(res.email);
      setForgotStep(2);
      setResendTimer(60);
      showToast(res.message || 'Verification code sent to your email.');
    } catch (err) {
      setForgotError(err.message || 'Could not send verification code. Please check SMTP settings or contact admin.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e) => {
    e.preventDefault();
    setForgotError('');

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setForgotError('Please enter the full 6-digit verification code.');
      return;
    }

    if (forgotType === 'pin') {
      const cleanPin = newPin.trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        setForgotError('PIN must be exactly 4 digits.');
        return;
      }
      if (cleanPin !== confirmPin.trim()) {
        setForgotError('PINs do not match.');
        return;
      }

      setForgotLoading(true);
      try {
        const res = await authAPI.verifyPasswordResetOtp(forgotTargetUser, cleanOtp, undefined, cleanPin);

        // Also update local storage accounts hash if present
        const key = (forgotTargetName || forgotTargetUser).toLowerCase();
        try {
          const accounts = JSON.parse(localStorage.getItem('listbook:accounts')) || {};
          accounts[key] = await sha256(key + ":" + cleanPin);
          localStorage.setItem('listbook:accounts', JSON.stringify(accounts));
        } catch {}

        setForgotStep(3);
        showToast(res.message || 'PIN reset successfully!');
      } catch (err) {
        setForgotError(err.message || 'Verification failed. Please check the OTP code and try again.');
      } finally {
        setForgotLoading(false);
      }
    } else {
      if (newPassword.length < 8) {
        setForgotError('Password must be at least 8 characters long.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setForgotError('Passwords do not match.');
        return;
      }

      setForgotLoading(true);
      try {
        const res = await authAPI.verifyPasswordResetOtp(forgotTargetUser, cleanOtp, newPassword);
        setForgotStep(3);
        showToast(res.message || 'Password reset successfully!');
      } catch (err) {
        setForgotError(err.message || 'Verification failed. Please check the OTP code and try again.');
      } finally {
        setForgotLoading(false);
      }
    }
  };

  const handleGoToForgot = (type = 'password') => {
    setForgotType(type);
    if (type === 'pin') {
      setForgotIdentifier(name.trim() || '');
    } else {
      setForgotIdentifier(username.trim() || '');
    }
    setForgotError('');
    setForgotStep(1);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setNewPin('');
    setConfirmPin('');
    setMode('forgot');
  };

  const handleBackToSignIn = () => {
    if (forgotType === 'pin') {
      setMode('local');
      if (forgotTargetName) {
        setName(forgotTargetName);
      }
    } else {
      setMode('team');
      if (forgotTargetUser) {
        setUsername(forgotTargetUser);
      }
    }
    setError('');
    setForgotError('');
  };

  return (
    <div className="login">
      {/* Dual-screen welcome panel on Microsoft Surface Duo & foldables */}
      <div className="login-duo-side">
        <div>
          <div className="brand">My<span>Deepwork</span></div>
        </div>
        <p className="tag">
          {pendingShareSid
            ? 'Someone shared a list or note with you. Sign in to open it.'
            : 'Lists, todos and notes in the order you want them. Star what matters and it stays on top.'}
        </p>
        <div className="duo-features">
          <div className="duo-feature-item">
            <span className="df-icon" aria-hidden="true">📝</span>
            <div className="df-text">
              <strong>Rich Notes & Ink</strong>
              <span>Checklists, formatting, drawings & audio</span>
            </div>
          </div>
          <div className="duo-feature-item">
            <span className="df-icon" aria-hidden="true">✅</span>
            <div className="df-text">
              <strong>Interactive Tasks</strong>
              <span>Voice input, priority stars & drag reorder</span>
            </div>
          </div>
          <div className="duo-feature-item">
            <span className="df-icon" aria-hidden="true">👥</span>
            <div className="df-text">
              <strong>Member CRM</strong>
              <span>Keep track of clients, stages & due follow-ups</span>
            </div>
          </div>
          <div className="duo-feature-item">
            <span className="df-icon" aria-hidden="true">📖</span>
            <div className="df-text">
              <strong>Daily Journal</strong>
              <span>Reflections, photos & yearly memories</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-card">
        <div>
          <div className="brand">My<span>Deepwork</span></div>
        </div>
        <p className="tag">
          {pendingShareSid
            ? 'Someone shared a list or note with you. Sign in to open it.'
            : 'Lists, todos and notes in the order you want them. Star what matters and it stays on top.'}
        </p>

        {mode === 'forgot' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <button
                type="button"
                className="icon-btn"
                style={{ width: '32px', height: '32px', margin: '-4px 0 0 -6px' }}
                onClick={handleBackToSignIn}
                aria-label="Back to sign in"
              >
                <BackIcon size={20} />
              </button>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--display)' }}>
                {forgotStep === 3
                  ? (forgotType === 'pin' ? 'PIN Updated' : 'Password Updated')
                  : (forgotType === 'pin' ? 'Reset 4-Digit PIN' : 'Reset Password')}
              </h3>
            </div>

            {forgotStep === 1 && (
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '.95rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  Enter your {forgotType === 'pin' ? 'name' : 'username'} or registered email address. We will send a 6-digit OTP verification code to your email.
                </p>

                <div className="field">
                  <label htmlFor="fIdent">
                    {forgotType === 'pin' ? 'Name or Email' : 'Username or Email'} <span className="req-star" aria-hidden="true">*</span>
                  </label>
                  <input
                    className="input"
                    id="fIdent"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder={forgotType === 'pin' ? 'e.g. Sachin or sachin@company.com' : 'e.g. aditi.rao or aditi@company.com'}
                    value={forgotIdentifier}
                    onChange={e => setForgotIdentifier(e.target.value)}
                    autoFocus
                    disabled={forgotLoading}
                  />
                </div>

                {forgotError && <div className="err">{forgotError}</div>}

                <button className="btn" type="submit" disabled={forgotLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <MailIcon size={18} />
                  <span>{forgotLoading ? 'Sending verification code…' : 'Send verification code'}</span>
                </button>

                <button
                  type="button"
                  className="link"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={handleBackToSignIn}
                >
                  ← Back to sign in
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOtpAndReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: '12px', padding: '12px 14px', fontSize: '.92rem', lineHeight: 1.5 }}>
                  Verification code sent to <strong>{forgotMaskedEmail}</strong>. Valid for 10 minutes.
                </div>

                <div className="field">
                  <label htmlFor="fOtp">6-Digit Verification Code (OTP) <span className="req-star" aria-hidden="true">*</span></label>
                  <input
                    className="input mono"
                    id="fOtp"
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    style={{ fontSize: '1.4rem', letterSpacing: '6px', textAlign: 'center', fontWeight: 'bold' }}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                    disabled={forgotLoading}
                  />
                </div>

                {forgotType === 'pin' ? (
                  <>
                    <div className="field">
                      <label htmlFor="fNewPin">New 4-Digit PIN <span className="req-star" aria-hidden="true">*</span></label>
                      <div className="pw-wrap">
                        <input
                          className="input mono"
                          id="fNewPin"
                          required
                          inputMode="numeric"
                          pattern="[0-9]{4}"
                          maxLength={4}
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="••••"
                          style={{ fontSize: '1.2rem', letterSpacing: '4px' }}
                          value={newPin}
                          onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          disabled={forgotLoading}
                        />
                        <button
                          type="button"
                          className="pw-eye"
                          aria-label="Show PIN"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          <EyeIcon />
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="fConfPin">Confirm 4-Digit PIN <span className="req-star" aria-hidden="true">*</span></label>
                      <div className="pw-wrap">
                        <input
                          className="input mono"
                          id="fConfPin"
                          required
                          inputMode="numeric"
                          pattern="[0-9]{4}"
                          maxLength={4}
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="••••"
                          style={{ fontSize: '1.2rem', letterSpacing: '4px' }}
                          value={confirmPin}
                          onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          disabled={forgotLoading}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="fNewPass">New Password <span className="req-star" aria-hidden="true">*</span></label>
                      <div className="pw-wrap">
                        <input
                          className="input"
                          id="fNewPass"
                          required
                          minLength={8}
                          type={showNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          disabled={forgotLoading}
                        />
                        <button
                          type="button"
                          className="pw-eye"
                          aria-label="Show password"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          <EyeIcon />
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="fConfPass">Confirm New Password <span className="req-star" aria-hidden="true">*</span></label>
                      <div className="pw-wrap">
                        <input
                          className="input"
                          id="fConfPass"
                          required
                          minLength={8}
                          type={showNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          disabled={forgotLoading}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.88rem' }}>
                  <span style={{ color: 'var(--muted)' }}>
                    Didn't receive the email?
                  </span>
                  {resendTimer > 0 ? (
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>
                      Resend in {resendTimer}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="link"
                      onClick={handleRequestOtp}
                      disabled={forgotLoading}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Resend OTP code
                    </button>
                  )}
                </div>

                {forgotError && <div className="err">{forgotError}</div>}

                <button className="btn" type="submit" disabled={forgotLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <CheckIcon size={18} />
                  <span>{forgotLoading ? 'Verifying & resetting…' : `Reset ${forgotType === 'pin' ? 'PIN' : 'password'} & continue`}</span>
                </button>

                <button
                  type="button"
                  className="link"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => setForgotStep(1)}
                >
                  ← Use a different {forgotType === 'pin' ? 'name' : 'username'} or email
                </button>
              </form>
            )}

            {forgotStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                  <CheckIcon size={28} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>
                    {forgotType === 'pin' ? 'PIN Reset Successful!' : 'Password Reset Successful!'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '.95rem', color: 'var(--muted)' }}>
                    Your {forgotType === 'pin' ? '4-digit PIN' : 'password'} has been updated. You can now sign in with your new {forgotType === 'pin' ? 'PIN' : 'password'}.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', marginTop: '8px' }}
                  onClick={handleBackToSignIn}
                >
                  Sign in with {forgotType === 'pin' ? 'PIN' : 'password'} now
                </button>
              </div>
            )}
          </div>
        ) : mode === 'local' ? (
          <form onSubmit={handleLocalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} autoComplete="off">
            <div className="field">
              <label htmlFor="lname">Name <span className="req-star" aria-hidden="true">*</span></label>
              <input
                className="input"
                id="lname"
                required
                maxLength={40}
                placeholder="e.g. Sachin"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <label htmlFor="lpin" style={{ margin: 0 }}>4-digit PIN <span className="req-star" aria-hidden="true">*</span></label>
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: '.84rem', color: 'var(--accent)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => handleOpenContactAdmin('pin')}
                >
                  Forgot PIN?
                </button>
              </div>
              <input
                className="input"
                id="lpin"
                required
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                type="password"
                placeholder="••••"
                value={pin}
                onChange={e => setPin(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && <div className="err">{error}</div>}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="login-note">
              New name? An account is created with that PIN. Forgot your PIN? Tap "Forgot PIN?" above to contact the admin.
            </p>

            <button
              type="button"
              className="link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => { setMode('team'); setError(''); }}
            >
              Sign in with a team account instead
            </button>
          </form>
        ) : (
          <form onSubmit={handleTeamSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} autoComplete="on">
            <div className="field">
              <label htmlFor="aUser">Username <span className="req-star" aria-hidden="true">*</span></label>
              <input
                className="input"
                id="aUser"
                required
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="username"
                placeholder="e.g. aditi.rao"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <label htmlFor="aPass" style={{ margin: 0 }}>Password <span className="req-star" aria-hidden="true">*</span></label>
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: '.84rem', color: 'var(--accent)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => handleOpenContactAdmin('password')}
                >
                  Forgot password?
                </button>
              </div>
              <div className="pw-wrap">
                <input
                  className="input"
                  id="aPass"
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="pw-eye"
                  aria-label="Show password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <EyeIcon />
                </button>
              </div>
            </div>

            {error && <div className="err">{error}</div>}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="login-note">
              Forgot your password? Tap "Forgot password?" above to submit a reset query to the administrator.
            </p>

            {!requireLogin && (
              <button
                type="button"
                className="link"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => { setMode('local'); setError(''); }}
              >
                Use a PIN login instead
              </button>
            )}
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            className="link"
            style={{ fontSize: '.84rem', color: 'var(--muted)', textDecoration: 'none' }}
            onClick={() => openPrivacyPolicy('view')}
          >
            Privacy Policy · DPDP Act 2023
          </button>
        </div>
      </div>

      {/* Contact Admin Modal for Forgot PIN / Password */}
      {showContactAdmin && (
        <div
          className="modal-back"
          onClick={() => setShowContactAdmin(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal"
            style={{ maxWidth: '440px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                  <KeyIcon size={20} />
                </div>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                  {adminReqType === 'pin' ? 'Forgot 4-Digit PIN' : 'Forgot Password'}
                </h2>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowContactAdmin(false)}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 22px' }}>
              {adminReqSuccess ? (
                <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                    <CheckIcon size={28} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontFamily: 'var(--display)' }}>
                      Query Sent to Administrator!
                    </h3>
                    <p style={{ margin: 0, fontSize: '.92rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                      Your reset query for <strong>{adminReqName}</strong> has been submitted.
                      Your email <strong>{adminReqEmail}</strong> was recorded with this request.
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: '.86rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                    The administrator will review your query in the Admin Panel and provide your new {adminReqType === 'pin' ? 'PIN' : 'credentials'}.
                  </p>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: '100%', marginTop: '6px' }}
                    onClick={() => setShowContactAdmin(false)}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitContactAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ margin: 0, fontSize: '.92rem', color: 'var(--muted)', lineHeight: 1.45 }}>
                    Enter your name and email address. An administrator will review your query in the Admin Panel to reset your {adminReqType === 'pin' ? 'PIN' : 'password'}.
                  </p>

                  <div className="field">
                    <label htmlFor="admReqName">
                      {adminReqType === 'pin' ? 'Your Name' : 'Username'} <span className="req-star" aria-hidden="true">*</span>
                    </label>
                    <input
                      className="input"
                      id="admReqName"
                      required
                      placeholder={adminReqType === 'pin' ? 'e.g. Sachin' : 'e.g. sachin.t'}
                      value={adminReqName}
                      onChange={e => setAdminReqName(e.target.value)}
                      disabled={adminReqSubmitting}
                      autoFocus
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="admReqEmail">
                      Your Email Address <span className="req-star" aria-hidden="true">*</span>
                    </label>
                    <input
                      className="input"
                      id="admReqEmail"
                      type="email"
                      required
                      placeholder="e.g. sachin@company.com"
                      value={adminReqEmail}
                      onChange={e => setAdminReqEmail(e.target.value)}
                      disabled={adminReqSubmitting}
                      autoCapitalize="none"
                      spellCheck="false"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="admReqNote">
                      Note / Message <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>(optional)</span>
                    </label>
                    <textarea
                      className="input"
                      id="admReqNote"
                      rows={2}
                      placeholder="Optional details for administrator..."
                      value={adminReqNote}
                      onChange={e => setAdminReqNote(e.target.value)}
                      disabled={adminReqSubmitting}
                      style={{ resize: 'none', minHeight: '60px' }}
                    />
                  </div>

                  {adminReqError && (
                    <div className="err" style={{ margin: 0 }}>{adminReqError}</div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ flex: 1 }}
                      onClick={() => setShowContactAdmin(false)}
                      disabled={adminReqSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn"
                      style={{ flex: 1.5 }}
                      disabled={adminReqSubmitting}
                    >
                      {adminReqSubmitting ? 'Submitting…' : 'Submit Query'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
