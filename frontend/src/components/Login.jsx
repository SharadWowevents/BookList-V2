import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { authAPI, setToken, adminAPI } from '../services/api';
import { EyeIcon } from './Icons';

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
  const { setSession, showToast } = useApp();

  const [mode, setMode] = useState('local');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requireLogin, setRequireLogin] = useState(false);

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

      setSession({ mode: 'local', key, name: trimmedName });
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
      }
    } catch (err) {
      setError(err.message || "That username and password don't match.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div>
          <div className="brand">My<span>Deepwork</span></div>
        </div>
        <p className="tag">
          Lists, todos and notes in the order you want them. Star what matters and it stays on top.
        </p>

        {mode === 'local' ? (
          <form onSubmit={handleLocalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} autoComplete="off">
            <div className="field">
              <label htmlFor="lname">Name</label>
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
              <label htmlFor="lpin">4-digit PIN</label>
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
              <label htmlFor="aUser">Username</label>
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
              <label htmlFor="aPass">Password</label>
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
              Your admin gives you a username and password. Forgot it? Ask them to reset it.
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
      </div>
    </div>
  );
};
