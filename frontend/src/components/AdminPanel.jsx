import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { adminAPI } from '../services/api';
import {
  BackIcon, KeyIcon, PauseIcon, PlayIcon, TrashIcon, RefreshIcon,
  EyeIcon, CopyIcon, PencilIcon, XIcon, CrmIcon, UndoIcon,
  DatabaseIcon, HistoryIcon, DownloadIcon, CheckIcon, SearchIcon, UsersIcon, MailIcon
} from './Icons';

const WORDS = "amber,atlas,bloom,cedar,coral,delta,ember,fable,grove,harbor,indigo,juniper,lotus,maple,meadow,nova,orbit,pebble,quartz,river,saffron,summit,tango,tidal,velvet,willow,zephyr,canyon,falcon,lagoon".split(",");

function genPassword() {
  const r = new Uint32Array(3);
  crypto.getRandomValues(r);
  return `${WORDS[r[0] % WORDS.length]}-${WORDS[r[1] % WORDS.length]}-${String(1000 + (r[2] % 9000))}`;
}

const suggestUsername = (name) =>
  name.toLowerCase().normalize("NFKD").replace(/[^\w\s.-]/g, "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".").replace(/[^a-z0-9._-]/g, "").slice(0, 30);

const timeAgo = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const formatFullDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const AdminPanel = () => {
  const { setUi, showToast, session, board, navigate, reloadBoard, saveNoteBody, loadCrmMembers } = useApp();

  useEffect(() => {
    if (session?.role !== 'admin') {
      setUi(prev => ({ ...prev, admin: false }));
    }
  }, [session, setUi]);

  if (session?.role !== 'admin') {
    return null;
  }

  // Active sub-tab: 'people' | 'backups' | 'logs'
  const [activeTab, setActiveTab] = useState('people');

  // People Tab State
  const [requireLogin, setRequireLogin] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userTouched, setUserTouched] = useState(false);
  const [password, setPassword] = useState(genPassword);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [creds, setCreds] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelUser, setConfirmDelUser] = useState(null);
  const [busy, setBusy] = useState(false);

  // Rename user state
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  // Backups Tab State
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupConfig, setBackupConfig] = useState({
    autoBackupEnabled: true,
    intervalHours: 24,
    lastAutoBackup: null
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [manualLabel, setManualLabel] = useState('');
  const [manualCreating, setManualCreating] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmDeleteBkpId, setConfirmDeleteBkpId] = useState(null);

  // Activity Logs Tab State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logCategory, setLogCategory] = useState('all');
  const [undoingId, setUndoingId] = useState(null);
  const [confirmUndoId, setConfirmUndoId] = useState(null);

  // Reset Queries Tab State
  const [resetRequests, setResetRequests] = useState([]);
  const [resetRequestsLoading, setResetRequestsLoading] = useState(false);
  const [queryFilter, setQueryFilter] = useState('pending'); // 'pending' | 'all' | 'accepted' | 'declined'
  const [acceptModal, setAcceptModal] = useState({ open: false, request: null });
  const [acceptCredInput, setAcceptCredInput] = useState('');
  const [acceptAdminNote, setAcceptAdminNote] = useState('');
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [acceptedResult, setAcceptedResult] = useState(null);
  const [declineModal, setDeclineModal] = useState({ open: false, request: null });
  const [declineAdminNote, setDeclineAdminNote] = useState('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [deleteConfirmReq, setDeleteConfirmReq] = useState(null);
  const [deletingReq, setDeletingReq] = useState(false);

  // Initial load
  useEffect(() => {
    let ignore = false;
    Promise.all([
      adminAPI.getConfig().catch(() => ({ requireLogin: false })),
      adminAPI.getUsers().catch(() => ({ users: [] })),
      adminAPI.getBackups().catch(() => ({ backups: [] })),
      adminAPI.getBackupConfig().catch(() => ({ autoBackupEnabled: true, intervalHours: 24 })),
      adminAPI.getLogs({ limit: 200 }).catch(() => ({ logs: [] })),
      adminAPI.getResetRequests().catch(() => ({ requests: [] }))
    ]).then(([cfg, usersRes, bkpRes, bkpCfg, logsRes, reqRes]) => {
      if (!ignore) {
        setRequireLogin(!!cfg?.requireLogin);
        setTeamUsers(usersRes?.users || []);
        setBackups(bkpRes?.backups || []);
        if (bkpCfg) setBackupConfig(bkpCfg);
        setLogs(logsRes?.logs || []);
        setResetRequests(reqRes?.requests || []);
        setLoading(false);
      }
    }).catch(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  // Reload tab data when switched
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'backups') {
      loadBackups();
      loadBackupConfig();
    } else if (tab === 'logs') {
      loadLogs();
    } else if (tab === 'queries') {
      loadResetRequests();
    }
  };

  const loadResetRequests = async () => {
    setResetRequestsLoading(true);
    try {
      const res = await adminAPI.getResetRequests();
      setResetRequests(res?.requests || []);
    } catch {
      showToast('Could not load reset requests.');
    } finally {
      setResetRequestsLoading(false);
    }
  };

  const handleOpenAcceptModal = (req) => {
    const defaultCred = req.type === 'pin'
      ? String(Math.floor(1000 + Math.random() * 9000))
      : genPassword();
    setAcceptCredInput(defaultCred);
    setAcceptAdminNote('');
    setAcceptModal({ open: true, request: req });
  };

  const handleConfirmAccept = async (e) => {
    e.preventDefault();
    if (!acceptModal.request) return;
    const req = acceptModal.request;
    const cred = acceptCredInput.trim();

    if (req.type === 'pin' && !/^\d{4}$/.test(cred)) {
      showToast('PIN must be exactly 4 digits.');
      return;
    }
    if (req.type === 'password' && cred.length < 8) {
      showToast('Password must be at least 8 characters.');
      return;
    }

    setAcceptSubmitting(true);
    try {
      const res = await adminAPI.acceptResetRequest(req._id, cred, acceptAdminNote);
      showToast(res.message || 'Reset request accepted.');
      setAcceptedResult({
        open: true,
        cred: res.newCred || cred,
        username: req.username || req.identifier,
        name: req.name || req.identifier,
        type: req.type,
        email: req.email
      });
      setAcceptModal({ open: false, request: null });
      loadResetRequests();
      adminAPI.getUsers().then(uRes => setTeamUsers(uRes?.users || [])).catch(() => {});
    } catch (err) {
      showToast(err.message || 'Failed to accept reset request.');
    } finally {
      setAcceptSubmitting(false);
    }
  };

  const handleOpenDeclineModal = (req) => {
    setDeclineAdminNote('');
    setDeclineModal({ open: true, request: req });
  };

  const handleConfirmDecline = async (e) => {
    e.preventDefault();
    if (!declineModal.request) return;
    setDeclineSubmitting(true);
    try {
      const res = await adminAPI.declineResetRequest(declineModal.request._id, declineAdminNote);
      showToast(res.message || 'Reset query declined.');
      setDeclineModal({ open: false, request: null });
      loadResetRequests();
    } catch (err) {
      showToast(err.message || 'Failed to decline request.');
    } finally {
      setDeclineSubmitting(false);
    }
  };

  const handleDeleteRequest = async (id) => {
    setDeletingReq(true);
    try {
      await adminAPI.deleteResetRequest(id);
      showToast('Reset request deleted.');
      setDeleteConfirmReq(null);
      loadResetRequests();
    } catch (err) {
      showToast(err.message || 'Failed to delete request.');
    } finally {
      setDeletingReq(false);
    }
  };

  const copyAcceptedCreds = () => {
    if (!acceptedResult) return;
    const txt = `MyDeepwork Sign-In Details\nAccount: ${acceptedResult.name} (@${acceptedResult.username})\nNew ${acceptedResult.type === 'pin' ? '4-Digit PIN' : 'Password'}: ${acceptedResult.cred}\nSign in: ${window.location.origin}/login`;
    navigator.clipboard.writeText(txt).then(
      () => showToast('New sign-in details copied!'),
      () => showToast('Details copied.')
    );
  };

  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const res = await adminAPI.getBackups();
      setBackups(res?.backups || []);
    } catch {
      showToast('Could not load backups.');
    } finally {
      setBackupsLoading(false);
    }
  };

  const loadBackupConfig = async () => {
    try {
      const cfg = await adminAPI.getBackupConfig();
      if (cfg) setBackupConfig(cfg);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await adminAPI.getLogs({ limit: 200 });
      setLogs(res?.logs || []);
    } catch {
      showToast('Could not load activity logs.');
    } finally {
      setLogsLoading(false);
    }
  };

  // People handlers
  const handleNameChange = (e) => {
    const v = e.target.value;
    setName(v);
    if (!userTouched) setUsername(suggestUsername(v));
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
      showToast('Could not update setting.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter a full name.');
    if (!username.trim()) return setError('Please enter a username.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');

    setBusy(true);
    setError('');

    try {
      const newUser = await adminAPI.createUser({
        name,
        username,
        password,
        email: userEmail.trim() || undefined
      });
      setTeamUsers(prev => [newUser, ...prev]);
      setCreds({ name: newUser.name, u: newUser.u, pw: password, reset: false });
      setName('');
      setUsername('');
      setUserEmail('');
      setUserTouched(false);
      setPassword(genPassword());
      showToast(`Sign-in created for ${newUser.name}.`);
      if (activeTab === 'logs') loadLogs();
    } catch (err) {
      setError(err.message || 'Could not create user.');
    } finally {
      setBusy(false);
    }
  };

  const startEditing = (u) => {
    setEditingUser(u.u);
    setEditName(u.name || u.u);
    setEditUsername(u.u);
    setEditEmail(u.email || '');
    setEditError('');
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setEditName('');
    setEditUsername('');
    setEditEmail('');
    setEditError('');
  };

  const handleSaveRename = async (u) => {
    if (!editName.trim()) return setEditError('Display name cannot be empty.');
    setEditBusy(true);
    setEditError('');

    try {
      const res = await adminAPI.renameUser(u.u, {
        name: editName.trim(),
        newUsername: editUsername.trim(),
        email: editEmail.trim()
      });

      setTeamUsers(prev => prev.map(item => item.u === u.u ? { ...item, ...res.user } : item));
      showToast('User updated successfully.');
      cancelEditing();
      if (activeTab === 'logs') loadLogs();
    } catch (err) {
      setEditError(err.message || 'Failed to update user.');
    } finally {
      setEditBusy(false);
    }
  };

  const toggleUserStatus = async (u) => {
    try {
      const res = await adminAPI.toggleUserStatus(u);
      setTeamUsers(prev => prev.map(user => user.u === u ? { ...user, status: res.status } : user));
      showToast(`User @${u} turned ${res.status === 'active' ? 'on' : 'off'}.`);
      if (activeTab === 'logs') loadLogs();
    } catch {
      showToast('Could not change user status.');
    }
  };

  const handleToggleCrm = async (u) => {
    try {
      const res = await adminAPI.toggleUserCrm(u);
      setTeamUsers(prev => prev.map(user => user.u === u ? { ...user, crm: res.crm } : user));
      showToast(`${res.crm ? 'Granted' : 'Revoked'} CRM access for @${u}.`);
      if (activeTab === 'logs') loadLogs();
    } catch {
      showToast('Could not update CRM access.');
    }
  };

  const handleResetPassword = async (u) => {
    const newPw = genPassword();
    try {
      await adminAPI.resetPassword(u.u, newPw);
      setCreds({ name: u.name, u: u.u, pw: newPw, reset: true });
      showToast(`New password generated for ${u.name || u.u}.`);
      if (activeTab === 'logs') loadLogs();
    } catch {
      showToast('Could not reset password.');
    }
  };

  const handleDeleteUser = async (u) => {
    try {
      await adminAPI.deleteUser(u);
      setTeamUsers(prev => prev.filter(user => user.u !== u));
      setConfirmDelUser(null);
      showToast(`Deleted user @${u}.`);
      if (activeTab === 'logs') loadLogs();
    } catch {
      showToast('Could not delete user.');
    }
  };

  // Backup handlers
  const handleSaveBackupConfig = async (updates) => {
    setConfigSaving(true);
    try {
      const payload = {
        autoBackupEnabled: updates.autoBackupEnabled !== undefined ? updates.autoBackupEnabled : backupConfig.autoBackupEnabled,
        intervalHours: updates.intervalHours !== undefined ? updates.intervalHours : backupConfig.intervalHours
      };
      const res = await adminAPI.updateBackupConfig(payload);
      setBackupConfig(res);
      showToast('Backup settings updated.');
    } catch {
      showToast('Could not update backup settings.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleCreateManualBackup = async (e) => {
    e.preventDefault();
    setManualCreating(true);
    try {
      const res = await adminAPI.createBackup(manualLabel);
      showToast(res.message || 'Manual backup created successfully.');
      setManualLabel('');
      await loadBackups();
    } catch (err) {
      showToast(err.message || 'Error creating backup.');
    } finally {
      setManualCreating(false);
    }
  };

  const handleRestoreBackup = async (id) => {
    setRestoringId(id);
    try {
      const res = await adminAPI.restoreBackup(id);
      showToast(res.message || 'Backup restored! Reloading application...');
      setConfirmRestoreId(null);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      showToast(err.message || 'Failed to restore backup.');
      setRestoringId(null);
    }
  };

  const handleDeleteBackup = async (id) => {
    try {
      await adminAPI.deleteBackup(id);
      showToast('Backup deleted.');
      setConfirmDeleteBkpId(null);
      await loadBackups();
    } catch {
      showToast('Could not delete backup.');
    }
  };

  // Activity Logs handlers
  const handleUndoLog = async (log) => {
    setUndoingId(log.id);
    try {
      await adminAPI.undoLog(log.id);
      showToast('Step undone successfully!');
      setConfirmUndoId(null);
      // Mark as undone in local view
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, isUndone: true, undoneBy: session?.username || 'admin' } : l));

      // If it was a deleted note, restore its content into cache & localStorage immediately
      if (log.action === 'delete_note' && log.targetId) {
        const restoredHtml = log.previousState?.html || '';
        saveNoteBody(log.targetId, restoredHtml);
      }

      // Reload board so restored list/note immediately appears in sidebar & state without refresh
      await reloadBoard();

      if (log.category === 'crm') {
        loadCrmMembers();
      }

      // Refresh logs list
      setTimeout(() => loadLogs(), 800);
    } catch (err) {
      showToast(err.message || 'Error undoing step.');
    } finally {
      setUndoingId(null);
    }
  };

  const activeCount = teamUsers.filter(u => u.status === 'active').length;
  const filteredUsers = teamUsers.filter(u =>
    !searchQuery ||
    u.u.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogs = useMemo(() => {
    const q = (logSearch || '').trim().toLowerCase();
    return logs.filter(log => {
      if (logCategory !== 'all' && log.category !== logCategory) return false;
      if (!q) return true;
      const details = (log.details || '').toLowerCase();
      const actorName = (log.actorName || '').toLowerCase();
      const actorUsername = (log.actorUsername || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const targetId = (log.targetId || '').toLowerCase();
      const targetType = (log.targetType || '').toLowerCase();
      const category = (log.category || '').toLowerCase();
      return (
        details.includes(q) ||
        actorName.includes(q) ||
        actorUsername.includes(q) ||
        action.includes(q) ||
        targetId.includes(q) ||
        targetType.includes(q) ||
        category.includes(q)
      );
    });
  }, [logs, logCategory, logSearch]);

  const pendingQueriesCount = resetRequests.filter(r => r.status === 'pending').length;
  const filteredRequests = useMemo(() => {
    return resetRequests.filter(r => {
      if (queryFilter === 'pending') return r.status === 'pending';
      if (queryFilter === 'accepted') return r.status === 'accepted';
      if (queryFilter === 'declined') return r.status === 'declined';
      return true;
    });
  }, [resetRequests, queryFilter]);

  const credsText = creds
    ? `MyDeepwork sign-in\nLink: ${window.location.origin}/login\nUsername: ${creds.u}\nPassword: ${creds.pw}`
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
          onClick={() => {
            setUi(prev => ({ ...prev, admin: false }));
            navigate('/' + (board?.tab || 'notes'));
          }}
        >
          <BackIcon />
        </button>
        <div className="title-wrap">
          <div className="title">
            {activeTab === 'people' && 'People & Access'}
            {activeTab === 'backups' && 'Backups'}
            {activeTab === 'logs' && 'Activity Logs'}
            {activeTab === 'queries' && 'Reset Queries'}
          </div>
          <div className="sub">
            {activeTab === 'people' && (loading ? 'Loading…' : `${activeCount} active · ${teamUsers.length - activeCount} turned off`)}
            {activeTab === 'backups' && `${backups.length} of 5 capacity · Auto-backup ${backupConfig.autoBackupEnabled ? `every ${backupConfig.intervalHours}h` : 'off'}`}
            {activeTab === 'logs' && `${logs.length} of 200 logs · Reversible audit trail`}
            {activeTab === 'queries' && (resetRequestsLoading ? 'Loading queries…' : `${pendingQueriesCount} pending review · ${resetRequests.length} total queries`)}
          </div>
        </div>
      </div>

      <div className="admin-scroll" id="adminPage">
        <div className="admin-inner">

          {/* Top Segmented Navigation Tabs */}
          <div className="admin-tabs" role="tablist">
            <button
              type="button"
              className={`admin-tab ${activeTab === 'people' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'people'}
              onClick={() => handleTabChange('people')}
            >
              <UsersIcon size={18} />
              <span>People</span>
              <span className="admin-tab-badge">{teamUsers.length}</span>
            </button>

            <button
              type="button"
              className={`admin-tab ${activeTab === 'backups' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'backups'}
              onClick={() => handleTabChange('backups')}
            >
              <DatabaseIcon size={18} />
              <span>Backups</span>
              <span className="admin-tab-badge">{backups.length}/5</span>
            </button>

            <button
              type="button"
              className={`admin-tab ${activeTab === 'logs' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'logs'}
              onClick={() => handleTabChange('logs')}
            >
              <HistoryIcon size={18} />
              <span>Activity Logs</span>
              <span className="admin-tab-badge">{logs.length}/200</span>
            </button>

            <button
              type="button"
              className={`admin-tab ${activeTab === 'queries' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'queries'}
              onClick={() => handleTabChange('queries')}
            >
              <KeyIcon size={18} />
              <span>Reset Queries</span>
              {pendingQueriesCount > 0 ? (
                <span
                  className="admin-tab-badge"
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '2px 7px'
                  }}
                >
                  {pendingQueriesCount}
                </span>
              ) : (
                <span className="admin-tab-badge">{resetRequests.length}</span>
              )}
            </button>
          </div>

          {/* ==================================================== */}
          {/* TAB 1: PEOPLE                                        */}
          {/* ==================================================== */}
          {activeTab === 'people' && (
            <>
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
                    <label htmlFor="admName">Full name <span className="req-star" aria-hidden="true">*</span></label>
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
                    <label htmlFor="admUser">Username <span className="req-star" aria-hidden="true">*</span></label>
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
                    <label htmlFor="admEmail">Email <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(for OTP recovery)</small></label>
                    <input
                      className="input"
                      id="admEmail"
                      type="email"
                      maxLength={80}
                      placeholder="e.g. aditi@company.com"
                      value={userEmail}
                      onChange={e => setUserEmail(e.target.value)}
                      autoCapitalize="none"
                      spellCheck="false"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="admPw">Password <span className="req-star" aria-hidden="true">*</span></label>
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
                  <div>
                    <div className="card-title">Team</div>
                    <p className="card-note">Tap <b>CRM</b> to choose who can see the CRM. Admins always can.</p>
                  </div>
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
                    const isSelf = session?.username === u.u;
                    const isEditing = editingUser === u.u;

                    if (isEditing) {
                      return (
                        <div
                          key={u.u}
                          className="person"
                          style={{
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            gap: 12,
                            background: 'var(--soft)',
                            padding: '14px',
                            borderRadius: 14,
                            margin: '8px 0',
                            border: '1px solid var(--line)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span className="avatar sm">
                                {u.photo ? (
                                  <img src={u.photo} alt={editName || u.name || u.u} />
                                ) : (
                                  (editName || u.name || u.u).trim().charAt(0).toUpperCase()
                                )}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                                Rename {isSelf ? 'Your Account' : `@${u.u}`}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={cancelEditing}
                              title="Cancel"
                              aria-label="Cancel editing"
                              style={{ width: 30, height: 30 }}
                            >
                              <XIcon size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                            <div className="field" style={{ margin: 0 }}>
                              <label style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Full display name <span className="req-star" aria-hidden="true">*</span></label>
                              <input
                                className="input"
                                maxLength={60}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="e.g. Aditi Rao"
                                style={{ padding: '8px 12px', fontSize: '1rem' }}
                                autoFocus
                              />
                            </div>
                            <div className="field" style={{ margin: 0 }}>
                              <label style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Username handle</label>
                              <input
                                className="input"
                                maxLength={30}
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                                placeholder="e.g. aditi.rao"
                                autoCapitalize="none"
                                spellCheck="false"
                                style={{ padding: '8px 12px', fontSize: '1rem' }}
                              />
                            </div>
                            <div className="field" style={{ margin: 0 }}>
                              <label style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Email (for OTP recovery)</label>
                              <input
                                className="input"
                                type="email"
                                maxLength={80}
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="e.g. aditi@company.com"
                                autoCapitalize="none"
                                spellCheck="false"
                                style={{ padding: '8px 12px', fontSize: '1rem' }}
                              />
                            </div>
                          </div>

                          {editError && <div className="err" style={{ fontSize: '0.88rem' }}>{editError}</div>}

                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            <button
                              type="button"
                              className="pill ink"
                              onClick={() => handleSaveRename(u)}
                              disabled={editBusy}
                            >
                              {editBusy ? 'Saving…' : 'Save changes'}
                            </button>
                            <button
                              type="button"
                              className="pill plain"
                              onClick={cancelEditing}
                              disabled={editBusy}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={u.u} className={`person ${isOff ? 'off' : ''}`}>
                        <span className="avatar sm">
                          {u.photo ? (
                            <img src={u.photo} alt={u.name || u.u} />
                          ) : (
                            (u.name || u.u).trim().charAt(0).toUpperCase()
                          )}
                        </span>
                        <div className="person-main">
                          <div className="person-name">
                            {u.name || u.u}{' '}
                            {isSelf && (
                              <span className="pill-state is-on" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                You
                              </span>
                            )}
                            <span className={`pill-state ${isOff ? 'is-off' : 'is-on'}`}>
                              {isOff ? 'Turned off' : 'Active'}
                            </span>
                          </div>
                          <div className="person-sub">
                            @{u.u}{u.email ? ` · ${u.email}` : ''} · {u.lastSeen ? 'Active recently' : "Hasn't signed in yet"}
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
                                className={`crm-chip ${u.crm ? 'on' : ''}`}
                                onClick={() => handleToggleCrm(u.u)}
                                aria-pressed={!!u.crm}
                                title={u.crm ? "Has CRM access. Tap to remove." : "No CRM access. Tap to give access."}
                              >
                                <CrmIcon size={16} />
                                <span>CRM</span>
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                title="Rename"
                                aria-label={`Rename ${u.name || u.u}`}
                                onClick={() => startEditing(u)}
                              >
                                <PencilIcon />
                              </button>
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
                              {!isSelf && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Delete"
                                  aria-label={`Delete ${u.u}`}
                                  onClick={() => setConfirmDelUser(u.u)}
                                >
                                  <TrashIcon />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            </>
          )}

          {/* ==================================================== */}
          {/* TAB 2: BACKUPS                                       */}
          {/* ==================================================== */}
          {activeTab === 'backups' && (
            <>
              {/* Card 1: Automatic Schedule & Frequency */}
              <section className="card">
                <div className="switch-row">
                  <div>
                    <div className="card-title">Automatic Backup Schedule</div>
                    <p className="card-note">
                      Automatically snapshot all lists, notes, CRM records, and users.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`switch ${backupConfig.autoBackupEnabled ? 'on' : ''}`}
                    role="switch"
                    aria-checked={backupConfig.autoBackupEnabled}
                    aria-label="Toggle auto backup"
                    disabled={configSaving}
                    onClick={() => handleSaveBackupConfig({ autoBackupEnabled: !backupConfig.autoBackupEnabled })}
                  >
                    <i></i>
                  </button>
                </div>

                {backupConfig.autoBackupEnabled && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: 6 }}>
                      Backup frequency:
                    </div>
                    <div className="frequency-grid">
                      {[
                        { hours: 1, label: 'Every 1h' },
                        { hours: 6, label: 'Every 6h' },
                        { hours: 12, label: 'Every 12h' },
                        { hours: 24, label: 'Every 24h' },
                        { hours: 48, label: 'Every 48h' }
                      ].map(opt => (
                        <button
                          key={opt.hours}
                          type="button"
                          className={`frequency-btn ${backupConfig.intervalHours === opt.hours ? 'active' : ''}`}
                          disabled={configSaving}
                          onClick={() => handleSaveBackupConfig({ intervalHours: opt.hours })}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  <p className="card-note" style={{ fontSize: '0.88rem' }}>
                    {backupConfig.lastAutoBackup
                      ? `Last auto-backup: ${formatFullDate(backupConfig.lastAutoBackup)}`
                      : 'No automated backup has run yet.'}
                  </p>
                  <span className="pill-state is-on" style={{ fontSize: '0.74rem' }}>
                    Strict Limit: 5 Backups
                  </span>
                </div>
              </section>

              {/* Card 2: Manual Backup Trigger */}
              <section className="card">
                <div className="card-title">Create Manual Backup</div>
                <p className="card-note">
                  Take an instant snapshot of the entire workspace.
                </p>
                <form onSubmit={handleCreateManualBackup} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="Optional label (e.g. Before big update)"
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    style={{ flex: '1 1 240px', padding: '10px 14px' }}
                    maxLength={100}
                  />
                  <button className="btn" type="submit" disabled={manualCreating} style={{ flex: 'none', padding: '10px 18px' }}>
                    <DatabaseIcon size={18} />
                    <span>{manualCreating ? 'Creating…' : 'Take Backup Now'}</span>
                  </button>
                </form>
              </section>

              {/* Card 3: Saved Backups List (Max 5 Capacity) */}
              <section className="card">
                <div className="people-head">
                  <div>
                    <div className="card-title">Saved Backups ({backups.length} of 5)</div>
                    <p className="card-note">
                      Maximum 5 backups capacity. When a new backup is created, the oldest backup is automatically pruned.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Refresh backups list"
                    aria-label="Refresh backups"
                    onClick={loadBackups}
                    disabled={backupsLoading}
                  >
                    <RefreshIcon />
                  </button>
                </div>

                {backupsLoading ? (
                  <p className="card-note">Loading backups…</p>
                ) : !backups.length ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
                    <DatabaseIcon size={36} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No backups available yet.</p>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>Create a manual snapshot above or wait for the automatic scheduler.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {backups.map(bkp => {
                      const isConfirmingRestore = confirmRestoreId === bkp.id;
                      const isRestoring = restoringId === bkp.id;
                      const isConfirmingDelete = confirmDeleteBkpId === bkp.id;
                      const sizeKb = (bkp.size / 1024).toFixed(1);

                      return (
                        <div key={bkp.id} className="backup-card">
                          <div className="backup-head">
                            <div className="backup-title">
                              <span style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: bkp.type === 'manual' ? 'var(--accent)' : '#0891b2'
                              }}></span>
                              <span>{bkp.label || bkp.id}</span>
                              <span className={`pill-state ${bkp.type === 'manual' ? 'is-on' : 'is-off'}`} style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>
                                {bkp.type}
                              </span>
                            </div>
                            <div className="backup-meta">
                              <span>{timeAgo(bkp.createdAt)}</span>
                              <span>·</span>
                              <span>{formatFullDate(bkp.createdAt)}</span>
                              <span>·</span>
                              <span style={{ fontWeight: 600 }}>{sizeKb} KB</span>
                            </div>
                          </div>

                          <div className="backup-stats">
                            <span className="backup-stat-chip">📋 {bkp.counts?.lists ?? 0} lists</span>
                            <span className="backup-stat-chip">📝 {bkp.counts?.notes ?? 0} notes</span>
                            <span className="backup-stat-chip">👥 {bkp.counts?.crmMembers ?? 0} CRM members</span>
                            <span className="backup-stat-chip">👤 {bkp.counts?.users ?? 0} users</span>
                            {bkp.createdByName && (
                              <span className="backup-stat-chip" style={{ opacity: 0.8 }}>by {bkp.createdByName}</span>
                            )}
                          </div>

                          <div className="backup-actions">
                            {isConfirmingRestore ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239, 68, 68, 0.08)', padding: '8px 12px', borderRadius: 10, width: '100%', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.86rem', color: 'var(--danger)', fontWeight: 600 }}>
                                  ⚠️ Overwrite current lists, notes & CRM with this backup?
                                </span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="pill plain"
                                    onClick={() => setConfirmRestoreId(null)}
                                    disabled={isRestoring}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="pill danger"
                                    onClick={() => handleRestoreBackup(bkp.id)}
                                    disabled={isRestoring}
                                  >
                                    {isRestoring ? 'Restoring…' : 'Yes, Restore'}
                                  </button>
                                </div>
                              </div>
                            ) : isConfirmingDelete ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--soft)', padding: '6px 10px', borderRadius: 10 }}>
                                <span style={{ fontSize: '0.86rem', color: 'var(--muted)' }}>Delete this backup permanently?</span>
                                <button type="button" className="pill plain" onClick={() => setConfirmDeleteBkpId(null)}>Keep</button>
                                <button type="button" className="pill danger" onClick={() => handleDeleteBackup(bkp.id)}>Delete</button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="pill ink"
                                  onClick={() => setConfirmRestoreId(bkp.id)}
                                  title="Restore workspace to this snapshot"
                                >
                                  <UndoIcon size={16} />
                                  <span>Restore</span>
                                </button>

                                <a
                                  href={adminAPI.downloadBackupUrl(bkp.id)}
                                  download={`${bkp.id}.json`}
                                  className="pill plain"
                                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                  title="Download backup JSON"
                                >
                                  <DownloadIcon size={16} />
                                  <span>Download</span>
                                </a>

                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Delete backup"
                                  aria-label="Delete backup"
                                  onClick={() => setConfirmDeleteBkpId(bkp.id)}
                                >
                                  <TrashIcon size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ==================================================== */}
          {/* TAB 3: ACTIVITY LOGS                                 */}
          {/* ==================================================== */}
          {activeTab === 'logs' && (
            <section className="card">
              <div className="people-head">
                <div>
                  <div className="card-title">
                    {logSearch.trim() || logCategory !== 'all'
                      ? `Activity Logs (${filteredLogs.length} of ${logs.length})`
                      : `Activity Logs (${logs.length} of 200)`}
                  </div>
                  <p className="card-note">
                    Strict capacity of 200 logs. Oldest logs are automatically deleted as new actions occur. Admins can click Undo to revert any supported step.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  title="Refresh activity logs"
                  aria-label="Refresh logs"
                  onClick={() => loadLogs()}
                  disabled={logsLoading}
                >
                  <RefreshIcon />
                </button>
              </div>

              {/* Filters & Search */}
              <div className="log-filters">
                <div className="log-chips">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'lists', label: 'Lists' },
                    { id: 'notes', label: 'Notes' },
                    { id: 'crm', label: 'CRM' },
                    { id: 'backup', label: 'Backups' },
                    { id: 'admin', label: 'Admin' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`log-chip ${logCategory === cat.id ? 'active' : ''}`}
                      onClick={() => setLogCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <input
                    className="input search"
                    placeholder="Search logs…"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    style={{ fontSize: '0.9rem', padding: '6px 28px 6px 12px', minWidth: 160 }}
                  />
                  {logSearch && (
                    <button
                      type="button"
                      onClick={() => setLogSearch('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        lineHeight: 1,
                        padding: '0 4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Logs List */}
              {logsLoading ? (
                <p className="card-note">Loading activity trail…</p>
              ) : !filteredLogs.length ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                  <HistoryIcon size={36} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>
                    {logSearch.trim()
                      ? `No activity recorded matching "${logSearch}".`
                      : logCategory !== 'all'
                        ? `No activity recorded in "${logCategory}" category.`
                        : 'No activity recorded yet.'}
                  </p>
                  {(logSearch || logCategory !== 'all') && (
                    <button
                      type="button"
                      className="pill plain"
                      style={{ marginTop: 12, fontSize: '0.82rem' }}
                      onClick={() => {
                        setLogSearch('');
                        setLogCategory('all');
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filteredLogs.map(log => {
                    const isUndoing = undoingId === log.id;
                    const isConfirming = confirmUndoId === log.id;
                    const catClass = log.category || 'lists';

                    return (
                      <div key={log.id} className={`log-item ${log.isUndone ? 'undone' : ''}`}>
                        <div className="log-main">
                          <div className="log-top">
                            <span className={`log-tag ${catClass}`}>
                              {log.category || 'general'}
                            </span>
                            <span className="log-actor">
                              {log.actorName || log.actorUsername || 'System'}
                            </span>
                            {log.actorUsername && log.actorUsername !== 'system' && (
                              <span>@{log.actorUsername}</span>
                            )}
                            <span>·</span>
                            <span title={formatFullDate(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                          </div>

                          <div className="log-details">
                            {log.details}
                          </div>

                          {log.isUndone && (
                            <div style={{ marginTop: 2 }}>
                              <span className="badge-undone">
                                <CheckIcon size={14} />
                                <span>Undone {log.undoneBy ? `by @${log.undoneBy}` : ''} ({timeAgo(log.undoneAt)})</span>
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="log-action-col">
                          {log.isUndone ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, padding: '4px 8px' }}>
                              Reverted
                            </span>
                          ) : log.canUndo ? (
                            isConfirming ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--soft)', padding: '4px 8px', borderRadius: 10 }}>
                                <button
                                  type="button"
                                  className="pill plain"
                                  style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                                  onClick={() => setConfirmUndoId(null)}
                                  disabled={isUndoing}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="pill danger"
                                  style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                                  onClick={() => handleUndoLog(log)}
                                  disabled={isUndoing}
                                >
                                  {isUndoing ? 'Undoing…' : 'Confirm Undo'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn-undo"
                                onClick={() => setConfirmUndoId(log.id)}
                                title="Undo and revert this change"
                              >
                                <UndoIcon size={14} />
                                <span>Undo</span>
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ==================================================== */}
          {/* TAB 4: RESET QUERIES                                 */}
          {/* ==================================================== */}
          {activeTab === 'queries' && (
            <>
              <section className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div className="card-title">Password & PIN Reset Queries</div>
                    <p className="card-note">
                      Review requests from users who forgot their PIN or password. Accept to generate new credentials and link their email, or decline.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pill"
                    onClick={loadResetRequests}
                    disabled={resetRequestsLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshIcon size={16} />
                    <span>{resetRequestsLoading ? 'Refreshing…' : 'Refresh'}</span>
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="log-chips" style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    className={`log-chip ${queryFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setQueryFilter('pending')}
                  >
                    Pending ({pendingQueriesCount})
                  </button>
                  <button
                    type="button"
                    className={`log-chip ${queryFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setQueryFilter('all')}
                  >
                    All ({resetRequests.length})
                  </button>
                  <button
                    type="button"
                    className={`log-chip ${queryFilter === 'accepted' ? 'active' : ''}`}
                    onClick={() => setQueryFilter('accepted')}
                  >
                    Accepted ({resetRequests.filter(r => r.status === 'accepted').length})
                  </button>
                  <button
                    type="button"
                    className={`log-chip ${queryFilter === 'declined' ? 'active' : ''}`}
                    onClick={() => setQueryFilter('declined')}
                  >
                    Declined ({resetRequests.filter(r => r.status === 'declined').length})
                  </button>
                </div>

                {/* Requests List */}
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {resetRequestsLoading && resetRequests.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                      Loading reset queries…
                    </div>
                  ) : filteredRequests.length === 0 ? (
                    <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--muted)', background: 'var(--soft)', borderRadius: '14px', border: '1px dashed var(--line)' }}>
                      <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>
                        {queryFilter === 'pending' ? '🎉' : '📋'}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--ink)' }}>
                        {queryFilter === 'pending' ? 'No pending reset queries' : 'No queries match this filter'}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '.88rem' }}>
                        {queryFilter === 'pending' ? 'All reset requests have been reviewed.' : 'Queries will appear here when users submit reset requests.'}
                      </p>
                    </div>
                  ) : (
                    filteredRequests.map(req => {
                      const isPending = req.status === 'pending';
                      const isAccepted = req.status === 'accepted';
                      const isDeclined = req.status === 'declined';

                      return (
                        <div
                          key={req._id}
                          style={{
                            background: 'var(--panel)',
                            border: `1px solid ${isPending ? 'color-mix(in srgb, var(--accent) 35%, var(--line))' : 'var(--line)'}`,
                            borderRadius: '16px',
                            padding: '16px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: isPending ? '0 2px 8px rgba(0,0,0,.04)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: req.type === 'pin' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'color-mix(in srgb, #3b82f6 15%, transparent)',
                                color: req.type === 'pin' ? 'var(--accent)' : '#3b82f6',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 700
                              }}>
                                <KeyIcon size={20} />
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                                    {req.name || req.identifier}
                                  </span>
                                  {req.username && (
                                    <span style={{ color: 'var(--muted)', fontSize: '.88rem' }}>
                                      @{req.username}
                                    </span>
                                  )}
                                  <span style={{
                                    fontSize: '.75rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    textTransform: 'uppercase',
                                    background: req.type === 'pin' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'color-mix(in srgb, #3b82f6 12%, transparent)',
                                    color: req.type === 'pin' ? 'var(--accent)' : '#3b82f6'
                                  }}>
                                    {req.type === 'pin' ? '4-Digit PIN' : 'Password'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '.84rem', color: 'var(--muted)', marginTop: '2px' }}>
                                  Submitted {timeAgo(req.createdAt)} · {formatFullDate(req.createdAt)}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isPending && (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '.82rem',
                                  fontWeight: 700,
                                  background: 'color-mix(in srgb, #eab308 18%, transparent)',
                                  color: '#ca8a04',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}>
                                  ● Pending
                                </span>
                              )}
                              {isAccepted && (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '.82rem',
                                  fontWeight: 700,
                                  background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                                  color: 'var(--accent)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}>
                                  <CheckIcon size={14} /> Accepted
                                </span>
                              )}
                              {isDeclined && (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '.82rem',
                                  fontWeight: 700,
                                  background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
                                  color: 'var(--danger)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}>
                                  <XIcon size={14} /> Declined
                                </span>
                              )}

                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => setDeleteConfirmReq(req)}
                                title="Delete query record"
                                style={{ width: '32px', height: '32px', color: 'var(--muted)' }}
                              >
                                <TrashIcon size={17} />
                              </button>
                            </div>
                          </div>

                          {/* Email and note row */}
                          <div style={{
                            background: 'var(--soft)',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            fontSize: '.92rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '.84rem' }}>User Email:</span>
                              <a
                                href={`mailto:${req.email}`}
                                style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                              >
                                {req.email}
                              </a>
                            </div>
                            {req.note && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '.84rem' }}>User Note:</span>
                                <span style={{ color: 'var(--ink)' }}>{req.note}</span>
                              </div>
                            )}
                          </div>

                          {/* Status Resolution details */}
                          {isAccepted && (
                            <div style={{
                              background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                              borderRadius: '10px',
                              padding: '10px 14px',
                              fontSize: '.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '10px'
                            }}>
                              <div>
                                <div>
                                  Reset completed by <strong>@{req.resolvedBy}</strong> on {formatFullDate(req.resolvedAt)}.
                                </div>
                                {req.newCredGenerated && (
                                  <div style={{ marginTop: '4px' }}>
                                    Generated {req.type === 'pin' ? 'PIN' : 'Password'}: <code style={{ fontWeight: 700, padding: '2px 6px', background: 'var(--panel)', borderRadius: '6px', fontSize: '.95rem' }}>{req.newCredGenerated}</code>
                                  </div>
                                )}
                              </div>
                              {req.newCredGenerated && (
                                <button
                                  type="button"
                                  className="pill"
                                  style={{ padding: '6px 12px', fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                  onClick={() => {
                                    const txt = `MyDeepwork Sign-In Details\nAccount: ${req.name} (@${req.username})\nNew ${req.type === 'pin' ? '4-Digit PIN' : 'Password'}: ${req.newCredGenerated}\nSign in: ${window.location.origin}/login`;
                                    navigator.clipboard.writeText(txt).then(
                                      () => showToast('Credentials copied to clipboard!'),
                                      () => showToast('Credentials copied.')
                                    );
                                  }}
                                >
                                  <CopyIcon size={14} />
                                  <span>Copy Sign-In Details</span>
                                </button>
                              )}
                            </div>
                          )}

                          {isDeclined && (
                            <div style={{
                              background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
                              borderRadius: '10px',
                              padding: '10px 14px',
                              fontSize: '.9rem'
                            }}>
                              Declined by <strong>@{req.resolvedBy}</strong> on {formatFullDate(req.resolvedAt)}
                              {req.adminNote && <span> · Reason: “{req.adminNote}”</span>}
                            </div>
                          )}

                          {/* Actions for Pending */}
                          {isPending && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingTop: '4px' }}>
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '8px 18px', fontSize: '.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => handleOpenAcceptModal(req)}
                              >
                                <CheckIcon size={16} />
                                <span>Accept & Reset {req.type === 'pin' ? 'PIN' : 'Password'}</span>
                              </button>
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ padding: '8px 16px', fontSize: '.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => handleOpenDeclineModal(req)}
                              >
                                <XIcon size={16} />
                                <span>Decline</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </>
          )}

          <p className="card-note foot">
            {activeTab === 'people' && 'People can use their username and password to sign into MyDeepwork. Accounts are stored in MongoDB.'}
            {activeTab === 'backups' && 'Backups store lists, notes, CRM records, and users. Max capacity is 5 backups.'}
            {activeTab === 'logs' && 'Audit logs keep an immutable log of up to 200 operations with single-click undo.'}
            {activeTab === 'queries' && 'User password & PIN reset requests submitted from the login screen are reviewed and resolved here.'}
          </p>

        </div>
      </div>

      {/* Accept Reset Request Modal */}
      {acceptModal.open && acceptModal.request && (
        <div className="modal-back" onClick={() => !acceptSubmitting && setAcceptModal({ open: false, request: null })} role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                  <KeyIcon size={20} />
                </div>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                  Accept & Reset {acceptModal.request.type === 'pin' ? '4-Digit PIN' : 'Password'}
                </h2>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => !acceptSubmitting && setAcceptModal({ open: false, request: null })}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleConfirmAccept}>
              <div className="modal-body" style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'var(--soft)', padding: '12px 14px', borderRadius: '12px', fontSize: '.9rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>User:</strong> {acceptModal.request.name} {acceptModal.request.username ? `(@${acceptModal.request.username})` : ''}</div>
                  <div><strong>Email:</strong> {acceptModal.request.email}</div>
                  {acceptModal.request.note && (
                    <div style={{ color: 'var(--muted)', marginTop: '2px' }}>
                      <strong>User Note:</strong> “{acceptModal.request.note}”
                    </div>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="acceptCredInput">
                    {acceptModal.request.type === 'pin' ? 'New 4-Digit PIN' : 'New Password'} <span className="req-star" aria-hidden="true">*</span>
                  </label>
                  <input
                    className={`input ${acceptModal.request.type === 'pin' ? 'mono' : ''}`}
                    id="acceptCredInput"
                    required
                    maxLength={acceptModal.request.type === 'pin' ? 4 : 40}
                    placeholder={acceptModal.request.type === 'pin' ? 'e.g. 4819' : 'At least 8 characters'}
                    value={acceptCredInput}
                    onChange={e => setAcceptCredInput(acceptModal.request.type === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)}
                    disabled={acceptSubmitting}
                    autoFocus
                    style={acceptModal.request.type === 'pin' ? { fontSize: '1.25rem', letterSpacing: '4px', fontWeight: 'bold' } : {}}
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '.8rem' }}>
                    {acceptModal.request.type === 'pin'
                      ? 'We auto-generated a 4-digit PIN. You can change it or keep it.'
                      : 'We auto-generated a memorable password. You can change it or keep it.'}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="acceptAdminNote">
                    Admin Note <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>(optional record)</span>
                  </label>
                  <input
                    className="input"
                    id="acceptAdminNote"
                    placeholder="e.g. Verified by admin"
                    value={acceptAdminNote}
                    onChange={e => setAcceptAdminNote(e.target.value)}
                    disabled={acceptSubmitting}
                  />
                </div>
              </div>

              <div className="modal-foot">
                <div className="grow" />
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setAcceptModal({ open: false, request: null })}
                  disabled={acceptSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={acceptSubmitting || !acceptCredInput.trim()}
                >
                  {acceptSubmitting ? 'Resetting…' : 'Confirm & Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Result Modal */}
      {acceptedResult && (
        <div className="modal-back" onClick={() => setAcceptedResult(null)} role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Reset Successful</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setAcceptedResult(null)}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                <CheckIcon size={28} />
              </div>

              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontFamily: 'var(--display)' }}>
                  Credentials Updated!
                </h3>
                <p style={{ margin: 0, fontSize: '.92rem', color: 'var(--muted)' }}>
                  The account for <strong>{acceptedResult.name}</strong> has been reset.
                </p>
              </div>

              <div style={{
                width: '100%',
                background: 'var(--soft)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '14px 16px',
                textAlign: 'left',
                fontSize: '.92rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div><strong>Account:</strong> {acceptedResult.name} (@{acceptedResult.username})</div>
                <div><strong>Email:</strong> {acceptedResult.email}</div>
                <div>
                  <strong>New {acceptedResult.type === 'pin' ? '4-Digit PIN' : 'Password'}: </strong>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: acceptedResult.type === 'pin' ? '3px' : 'normal' }}>
                    {acceptedResult.cred}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={copyAcceptedCreds}
              >
                <CopyIcon size={18} />
                <span>Copy Sign-In Details to Clipboard</span>
              </button>

              <button
                type="button"
                className="link"
                onClick={() => setAcceptedResult(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Reset Request Modal */}
      {declineModal.open && declineModal.request && (
        <div className="modal-back" onClick={() => !declineSubmitting && setDeclineModal({ open: false, request: null })} role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Decline Reset Query</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => !declineSubmitting && setDeclineModal({ open: false, request: null })}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleConfirmDecline}>
              <div className="modal-body" style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ margin: 0, fontSize: '.92rem', color: 'var(--muted)' }}>
                  Are you sure you want to decline the reset query for <strong>{declineModal.request.name || declineModal.request.identifier}</strong>?
                </p>

                <div className="field">
                  <label htmlFor="declineReason">Reason for declining <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>(optional)</span></label>
                  <input
                    className="input"
                    id="declineReason"
                    placeholder="e.g. Unrecognized email / user not found"
                    value={declineAdminNote}
                    onChange={e => setDeclineAdminNote(e.target.value)}
                    disabled={declineSubmitting}
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-foot">
                <div className="grow" />
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setDeclineModal({ open: false, request: null })}
                  disabled={declineSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}
                  disabled={declineSubmitting}
                >
                  {declineSubmitting ? 'Declining…' : 'Decline Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Reset Request Modal */}
      {deleteConfirmReq && (
        <div className="modal-back" onClick={() => !deletingReq && setDeleteConfirmReq(null)} role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Delete Query Record</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => !deletingReq && setDeleteConfirmReq(null)}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '16px 22px' }}>
              <p style={{ margin: 0, fontSize: '.92rem', color: 'var(--muted)' }}>
                Permanently delete this reset query record for <strong>{deleteConfirmReq.name || deleteConfirmReq.identifier}</strong>?
              </p>
            </div>
            <div className="modal-foot">
              <div className="grow" />
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDeleteConfirmReq(null)}
                disabled={deletingReq}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}
                onClick={() => handleDeleteRequest(deleteConfirmReq._id)}
                disabled={deletingReq}
              >
                {deletingReq ? 'Deleting…' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
