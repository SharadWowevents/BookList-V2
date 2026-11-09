import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { authAPI, setToken, adminAPI } from '../services/api';
import { EyeIcon, MailIcon, CheckIcon, BackIcon } from './Icons';

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

  // Forgot password & OTP verification state
  const [forgotStep, setForgotStep] = useState(1); // 1: identifier, 2: otp & new password, 3: success
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotTargetUser, setForgotTargetUser] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      setForgotError('Please enter your username or registered email.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authAPI.requestPasswordResetOtp(id);
      setForgotTargetUser(res.username);
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
  };

  const handleGoToForgot = () => {
    setForgotIdentifier(username.trim() || '');
    setForgotError('');
    setForgotStep(1);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setMode('forgot');
  };

  const handleBackToSignIn = () => {
    setMode('team');
    setError('');
    setForgotError('');
    if (forgotTargetUser) {
      setUsername(forgotTargetUser);
    }
  };

  return (
    <div className="login">
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
                {forgotStep === 3 ? 'Password Updated' : 'Reset Password'}
              </h3>
            </div>

            {forgotStep === 1 && (
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '.95rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  Enter your username or registered email address. We will send a 6-digit OTP verification code to your email.
                </p>

                <div className="field">
                  <label htmlFor="fIdent">Username or Email <span className="req-star" aria-hidden="true">*</span></label>
                  <input
                    className="input"
                    id="fIdent"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="e.g. aditi.rao or aditi@company.com"
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
                  <span>{forgotLoading ? 'Verifying & resetting…' : 'Reset password & continue'}</span>
                </button>

                <button
                  type="button"
                  className="link"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => setForgotStep(1)}
                >
                  ← Use a different username or email
                </button>
              </form>
            )}

            {forgotStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                  <CheckIcon size={28} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>Password Reset Successful!</h4>
                  <p style={{ margin: 0, fontSize: '.95rem', color: 'var(--muted)' }}>
                    Your password has been updated. You can now sign in with your new password.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', marginTop: '8px' }}
                  onClick={handleBackToSignIn}
                >
                  Sign in now
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
              <label htmlFor="lpin">4-digit PIN <span className="req-star" aria-hidden="true">*</span></label>
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
              New name? An account is created with that PIN and saved securely in MongoDB.
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
                  onClick={handleGoToForgot}
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
              Forgot your password? Tap "Forgot password?" above to receive an OTP on your email, or ask an administrator.
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
    </div>
  );
};
