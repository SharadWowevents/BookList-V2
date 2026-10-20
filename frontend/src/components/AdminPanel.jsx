import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { adminAPI } from '../services/api';
import {
  BackIcon, KeyIcon, PauseIcon, PlayIcon, TrashIcon, RefreshIcon,
  EyeIcon, CopyIcon
} from './Icons';

const WORDS = "amber,atlas,bloom,cedar,coral,delta,ember,fable,grove,harbor,indigo,juniper,lotus,maple,meadow,nova,orbit,pebble,quartz,river,saffron,summit,tango,tidal,velvet,willow,zephyr,canyon,falcon,lagoon".split(",");

function genPassword() {
  const r = new Uint32Array(3);
  crypto.getRandomValues(r);
  return `${WORDS[r[0] % WORDS.length]}-${WORDS[r[1] % WORDS.length]}-${String(1000 + (r[2] % 9000))}`;
}

const suggestUsername = (name) =>
  name.toLowerCase().normalize("NFKD").replace(/[^\w\s.-]/g, "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".").replace(/[^a-z0-9._-]/g, "").slice(0, 30);

export const AdminPanel = () => {
  const { setUi, showToast } = useApp();

  const [requireLogin, setRequireLogin] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [userTouched, setUserTouched] = useState(false);
  const [password, setPassword] = useState(genPassword);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [creds, setCreds] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelUser, setConfirmDelUser] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      adminAPI.getConfig().catch(() => ({ requireLogin: false })),
      adminAPI.getUsers().catch(() => ({ users: [] }))
    ]).then(([cfg, usersRes]) => {
      if (!ignore) {
        setRequireLogin(!!cfg?.requireLogin);
        setTeamUsers(usersRes?.users || []);
        setLoading(false);
      }
    }).catch(() => {
      if (!ignore) {
        setLoading(false);
      }
    });
    return () => { ignore = true; };
  }, []);

  const handleNameChange = (e) => {
    const v = e.target.value;
    setName(v);
    if (!userTouched) {
      setUsername(suggestUsername(v));
    }
  };

  const handleUsernameChange = (e) => {
    setUserTouched(true);
    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
  };

  const handleToggleRequireLogin = async () => {
    const next = !requireLogin;
    setRequireLogin(next);
    try {
      await adminAPI.updateConfig({ requireLogin: next });
      showToast(next ? 'Sign-in is now required.' : 'Sign-in is no longer required.');
    } catch {
      setRequireLogin(!next);
      showToast('Could not update setting on backend.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedUser = username.trim().toLowerCase();

    if (!trimmedName) {
      setError("Enter the person's name.");
      return;
    }
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(trimmedUser)) {
      setError("Usernames are 3–30 characters: lowercase letters, numbers, dots, dashes or underscores.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }

    setBusy(true);

    try {
      const created = await adminAPI.createUser({
        name: trimmedName,
        username: trimmedUser,
        password
      });

      setTeamUsers(prev => [created, ...prev]);
      setCreds({ u: trimmedUser, pw: password, name: trimmedName, reset: false });
      setName('');
      setUsername('');
      setUserTouched(false);
      setPassword(genPassword());
      setShowPw(false);
      showToast(`${trimmedName} can now sign in.`);
    } catch (err) {
      setError(err.message || 'Could not create team user.');
    } finally {
      setBusy(false);
    }
  };

  const toggleUserStatus = async (u) => {
    try {
      const res = await adminAPI.toggleUserStatus(u);
      setTeamUsers(prev => prev.map(user => user.u === u ? { ...user, status: res.status } : user));
      showToast(res.status === 'active' ? `${res.name || u} can sign in again.` : `${res.name || u} is turned off.`);
    } catch {
      showToast('Could not change user status.');
    }
  };

  const handleResetPassword = async (user) => {
    const newPw = genPassword();
    try {
      await adminAPI.resetPassword(user.u, newPw);
      setCreds({ u: user.u, pw: newPw, name: user.name || user.u, reset: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast(`Password reset for ${user.name || user.u}.`);
    } catch {
      showToast('Could not reset password.');
    }
  };

  const handleDeleteUser = async (u) => {
    try {
      await adminAPI.deleteUser(u);
      setTeamUsers(prev => prev.filter(x => x.u !== u));
      setConfirmDelUser(null);
      showToast(`User ${u} deleted.`);
    } catch {
      showToast('Could not delete user.');
    }
  };

  const activeCount = teamUsers.filter(u => u.status === 'active').length;
  const filteredUsers = teamUsers.filter(u =>
    !searchQuery ||
    u.u.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const credsText = creds
    ? `MyDeepwork sign-in\nLink: ${window.location.origin}\nUsername: ${creds.u}\nPassword: ${creds.pw}`
    : '';

  const copyCreds = () => {
    navigator.clipboard.writeText(credsText).then(
      () => showToast('Sign-in details copied.'),
      () => showToast('Details selected.')
    );
  };

  return (
    <>
      <div className="main-head">
        <button
          type="button"
          className="icon-btn back"
          id="back"
          aria-label="Back"
          onClick={() => setUi(prev => ({ ...prev, admin: false }))}
        >
          <BackIcon />
        </button>
        <div className="title-wrap">
          <div className="title">People</div>
          <div className="sub">
            {loading ? 'Loading…' : `${activeCount} active · ${teamUsers.length - activeCount} turned off`}
          </div>
        </div>
      </div>

      <div className="admin-scroll" id="adminPage">
        <div className="admin-inner">
          <section className="card">
            <div className="switch-row">
              <div>
                <div className="card-title">Require sign-in</div>
                <p className="card-note">
                  {requireLogin
                    ? "On. People need a team username and password from this page to use MyDeepwork."
                    : "Off. Anyone can sign in with a PIN."}
                </p>
              </div>
              <button
                type="button"
                className={`switch ${requireLogin ? 'on' : ''}`}
                role="switch"
                aria-checked={requireLogin}
                aria-label="Require sign-in"
                onClick={handleToggleRequireLogin}
              >
                <i></i>
              </button>
            </div>
          </section>

          {creds && (
            <section className="card creds">
              <div className="card-title">
                {creds.reset ? 'New password for' : 'Sign-in details for'} {creds.name}
              </div>
              <dl>
                <dt>Username</dt>
                <dd>{creds.u}</dd>
                <dt>Password</dt>
                <dd className="mono">{creds.pw}</dd>
              </dl>
              <textarea
                className="sr-copy show"
                readOnly
                aria-label="Sign-in details"
                value={credsText}
              />
              <div className="row-gap">
                <button type="button" className="pill ink" onClick={copyCreds}>
                  <CopyIcon />
                  <span>Copy details</span>
                </button>
                <button type="button" className="pill plain" onClick={() => setCreds(null)}>
                  Done
                </button>
              </div>
              <p className="card-note">
                Send these to {creds.name} privately. The password isn't shown again; you can reset it any time.
              </p>
            </section>
          )}

          <section className="card">
            <div className="card-title">Add a person</div>
            <form onSubmit={handleCreateUser} className="adm-form" autoComplete="off">
              <div className="field">
                <label htmlFor="admName">Full name</label>
                <input
                  className="input"
                  id="admName"
                  maxLength={60}
                  placeholder="e.g. Aditi Rao"
                  value={name}
                  onChange={handleNameChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="admUser">Username</label>
                <input
                  className="input"
                  id="admUser"
                  maxLength={30}
                  placeholder="e.g. aditi.rao"
                  value={username}
                  onChange={handleUsernameChange}
                  autoCapitalize="none"
                  spellCheck="false"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="admPw">Password</label>
                <div className="pw-wrap">
                  <input
                    className="input mono"
                    id="admPw"
                    type={showPw ? 'text' : 'password'}
                    minLength={8}
                    maxLength={64}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="pw-eye"
                    aria-label="Show password"
                    onClick={() => setShowPw(!showPw)}
                  >
                    <EyeIcon />
                  </button>
                  <button
                    type="button"
                    className="pw-eye"
                    title="Make a new password"
                    aria-label="Make a new password"
                    onClick={() => {
                      setPassword(genPassword());
                      setShowPw(true);
                    }}
                  >
                    <RefreshIcon />
                  </button>
                </div>
              </div>

              {error && <div className="err">{error}</div>}

              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create sign-in'}
              </button>
            </form>
          </section>

          <section className="card">
            <div className="people-head">
              <div className="card-title">Team</div>
              {teamUsers.length > 4 && (
                <input
                  className="input search"
                  placeholder="Search people"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search people"
                />
              )}
            </div>

            {!teamUsers.length ? (
              <p className="card-note">No one yet. Add your first teammate above.</p>
            ) : (
              filteredUsers.map(u => {
                const isOff = u.status !== 'active';
                return (
                  <div key={u.u} className={`person ${isOff ? 'off' : ''}`}>
                    <span className="avatar sm">
                      {(u.name || u.u).trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="person-main">
                      <div className="person-name">
                        {u.name || u.u}{' '}
                        <span className={`pill-state ${isOff ? 'is-off' : 'is-on'}`}>
                          {isOff ? 'Turned off' : 'Active'}
                        </span>
                      </div>
                      <div className="person-sub">
                        @{u.u} · {u.lastSeen ? 'Active recently' : "Hasn't signed in yet"}
                      </div>
                    </div>
                    <div className="person-actions">
                      {confirmDelUser === u.u ? (
                        <>
                          <button
                            type="button"
                            className="pill plain"
                            onClick={() => setConfirmDelUser(null)}
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            className="pill danger"
                            onClick={() => handleDeleteUser(u.u)}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Reset password"
                            aria-label={`Reset password for ${u.u}`}
                            onClick={() => handleResetPassword(u)}
                          >
                            <KeyIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title={isOff ? 'Turn on' : 'Turn off'}
                            aria-label={`${isOff ? 'Turn on' : 'Turn off'} ${u.u}`}
                            onClick={() => toggleUserStatus(u.u)}
                          >
                            {isOff ? <PlayIcon /> : <PauseIcon />}
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Delete"
                            aria-label={`Delete ${u.u}`}
                            onClick={() => setConfirmDelUser(u.u)}
                          >
                            <TrashIcon />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <p className="card-note foot">
            People can use their username and password to sign into MyDeepwork. Accounts are stored in MongoDB.
          </p>
        </div>
      </div>
    </>
  );
};
