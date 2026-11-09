import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { Config } from '../models/Config.js';
import { Share } from '../models/Share.js';
import { ResetRequest } from '../models/ResetRequest.js';
import {
  createBackup,
  getBackups,
  getBackupById,
  restoreBackup,
  deleteBackup,
  getBackupConfig,
  updateBackupConfig
} from '../services/backupService.js';
import { recordLog, getLogs, undoLogEntry } from '../services/auditLogService.js';
import { testSmtpConnection } from '../services/emailService.js';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const getConfig = async (req, res) => {
  try {
    let config = await Config.findOne({ key: 'app' });
    if (!config) {
      config = await Config.create({ key: 'app', requireLogin: false });
    }
    res.json({ requireLogin: config.requireLogin });
  } catch (err) {
    console.error('getConfig error:', err);
    res.status(500).json({ message: 'Error retrieving system configuration.' });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const { requireLogin } = req.body;
    let config = await Config.findOne({ key: 'app' });
    if (!config) {
      config = new Config({ key: 'app' });
    }
    if (requireLogin !== undefined) {
      config.requireLogin = !!requireLogin;
    }
    await config.save();

    await recordLog({
      action: 'update_config',
      category: 'admin',
      actor: req.user,
      details: `${config.requireLogin ? 'Enabled' : 'Disabled'} required sign-in`,
      targetId: 'app',
      targetType: 'config',
      canUndo: false
    });

    res.json({ requireLogin: config.requireLogin });
  } catch (err) {
    console.error('updateConfig error:', err);
    res.status(500).json({ message: 'Error updating system configuration.' });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({
      users: users.map(u => ({
        u: u.username,
        name: u.name,
        email: u.email || '',
        status: u.status,
        role: u.role,
        crm: !!u.crm,
        authType: u.authType,
        photo: u.photo || null,
        lastSeen: u.lastSeen,
        createdAt: u.createdAt
      }))
    });
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ message: 'Error retrieving team members.' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, username, password, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    const u = (username || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(u)) {
      return res.status(400).json({ message: 'Usernames must be 3–30 characters: lowercase letters, numbers, dots, dashes or underscores.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    let cleanEmail = null;
    if (email && email.trim()) {
      const em = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
      }
      cleanEmail = em;
    }

    const existing = await User.findOne({ username: u });
    if (existing) {
      return res.status(400).json({ message: `“${u}” is already taken. Try another username.` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username: u,
      name: name.trim(),
      email: cleanEmail,
      authType: 'password',
      passwordHash,
      role: 'member',
      status: 'active'
    });

    // Seed default lists
    const t = s => ({ id: uid(), text: s, done: false, starred: false });
    const l1 = {
      userId: newUser._id,
      id: uid(),
      name: "Project Links",
      starred: false,
      order: 0,
      todos: [t("Live Tracker Link"), t("Online Project File Link"), t("Presentation Deck Link")]
    };
    const l2 = {
      userId: newUser._id,
      id: uid(),
      name: "This Week",
      starred: false,
      order: 1,
      todos: [t("Confirm venue walkthrough"), t("Send vendor shortlist")]
    };
    const l3 = {
      userId: newUser._id,
      id: uid(),
      name: "Ideas",
      starred: false,
      order: 2,
      todos: []
    };
    const createdLists = await List.insertMany([l1, l2, l3]);
    newUser.activeId = createdLists[0].id;
    await newUser.save();

    await recordLog({
      action: 'create_user',
      category: 'admin',
      actor: req.user,
      details: `Created user @${newUser.username} (${newUser.name})`,
      targetId: newUser.username,
      targetType: 'user',
      canUndo: true
    });

    res.status(201).json({
      u: newUser.username,
      name: newUser.name,
      email: newUser.email || '',
      status: newUser.status,
      role: newUser.role,
      crm: !!newUser.crm,
      photo: newUser.photo || null,
      createdAt: newUser.createdAt
    });
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ message: 'Error creating team user.' });
  }
};

export const toggleUserCrm = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.crm = !user.crm;
    await user.save();

    await recordLog({
      action: 'toggle_user_crm',
      category: 'admin',
      actor: req.user,
      details: `${user.crm ? 'Granted' : 'Revoked'} CRM access for @${user.username}`,
      targetId: user.username,
      targetType: 'user',
      canUndo: false
    });

    res.json({
      u: user.username,
      name: user.name,
      crm: user.crm,
      photo: user.photo || null
    });
  } catch (err) {
    console.error('toggleUserCrm error:', err);
    res.status(500).json({ message: 'Error updating CRM access.' });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.status = user.status === 'active' ? 'off' : 'active';
    await user.save();

    await recordLog({
      action: 'toggle_user_status',
      category: 'admin',
      actor: req.user,
      details: `${user.status === 'active' ? 'Turned on' : 'Turned off'} user @${user.username}`,
      targetId: user.username,
      targetType: 'user',
      canUndo: false
    });

    res.json({
      u: user.username,
      name: user.name,
      status: user.status,
      photo: user.photo || null
    });
  } catch (err) {
    console.error('toggleUserStatus error:', err);
    res.status(500).json({ message: 'Error toggling user status.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { username } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    await user.save();

    await recordLog({
      action: 'reset_password',
      category: 'admin',
      actor: req.user,
      details: `Reset password for @${user.username}`,
      targetId: user.username,
      targetType: 'user',
      canUndo: false
    });

    res.json({
      message: `Password reset successfully for ${user.name || user.username}.`
    });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'Error resetting password.' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Snapshot user data for undo
    const userLists = await List.find({ userId: user._id }).lean();
    const userNotes = await Note.find({ userId: user._id }).lean();

    // Clean up user's data
    await List.deleteMany({ userId: user._id });
    await Note.deleteMany({ userId: user._id });
    await Share.deleteMany({ ownerId: user._id });
    await User.deleteOne({ _id: user._id });

    await recordLog({
      action: 'delete_user',
      category: 'admin',
      actor: req.user,
      details: `Deleted user @${user.username} (${user.name}) and their data`,
      targetId: user.username,
      targetType: 'user',
      previousState: {
        user: user.toObject(),
        lists: userLists,
        notes: userNotes
      },
      canUndo: true
    });

    res.json({ message: `User ${user.name || username} deleted.` });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ message: 'Error deleting user.' });
  }
};

export const renameUser = async (req, res) => {
  try {
    const { username } = req.params;
    const { name, newUsername, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }

    const u = username.toLowerCase();
    const user = await User.findOne({ username: u });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const trimmedName = name.trim();
    const oldName = user.name;
    const oldUsername = user.username;
    user.name = trimmedName;

    if (email !== undefined) {
      const em = (email || '').trim().toLowerCase();
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
      }
      user.email = em || null;
    }

    let usernameChanged = false;

    if (newUsername && newUsername.trim()) {
      const targetUser = newUsername.trim().toLowerCase();
      if (targetUser !== user.username) {
        if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(targetUser)) {
          return res.status(400).json({
            message: 'Usernames must be 3–30 characters: lowercase letters, numbers, dots, dashes or underscores.'
          });
        }
        const existing = await User.findOne({ username: targetUser });
        if (existing && existing._id.toString() !== user._id.toString()) {
          return res.status(400).json({ message: `“${targetUser}” is already taken. Try another username.` });
        }
        user.username = targetUser;
        usernameChanged = true;
      }
    }

    await user.save();

    // Keep public and shared ownerName in sync
    await Share.updateMany({ ownerId: user._id }, { ownerName: trimmedName });

    await recordLog({
      action: 'rename_user',
      category: 'admin',
      actor: req.user,
      details: `Renamed user '${oldName}' to '${trimmedName}'${usernameChanged ? ` (@${user.username})` : ''}`,
      targetId: user.username,
      targetType: 'user',
      previousState: { name: oldName, username: oldUsername },
      newState: { name: trimmedName, username: user.username },
      canUndo: false
    });

    res.json({
      message: 'User renamed successfully.',
      user: {
        u: user.username,
        name: user.name,
        email: user.email || '',
        status: user.status,
        role: user.role,
        crm: !!user.crm,
        authType: user.authType,
        photo: user.photo || null,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt
      },
      usernameChanged,
      oldUsername
    });
  } catch (err) {
    console.error('renameUser error:', err);
    res.status(500).json({ message: 'Error renaming user.' });
  }
};

/* ============================================================
   BACKUP & LOG CONTROLLERS
   ============================================================ */

export const getBackupsController = async (req, res) => {
  try {
    const backups = await getBackups();
    res.json({ backups });
  } catch (err) {
    console.error('getBackups error:', err);
    res.status(500).json({ message: 'Error retrieving backups.' });
  }
};

export const createManualBackupController = async (req, res) => {
  try {
    const { label } = req.body;
    const backup = await createBackup({
      type: 'manual',
      createdBy: req.user?.username || 'admin',
      createdByName: req.user?.name || 'Admin',
      label: label || ''
    });
    res.status(201).json({ backup, message: 'Backup created successfully.' });
  } catch (err) {
    console.error('createManualBackup error:', err);
    res.status(500).json({ message: 'Error creating manual backup.' });
  }
};

export const restoreBackupController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await restoreBackup(id, req.user);
    res.json(result);
  } catch (err) {
    console.error('restoreBackup error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Error restoring backup.' });
  }
};

export const deleteBackupController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteBackup(id, req.user);
    res.json(result);
  } catch (err) {
    console.error('deleteBackup error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Error deleting backup.' });
  }
};

export const downloadBackupController = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await getBackupById(id);
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found.' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.id}.json"`);
    res.send(JSON.stringify(backup.data, null, 2));
  } catch (err) {
    console.error('downloadBackup error:', err);
    res.status(500).json({ message: 'Error downloading backup.' });
  }
};

export const getBackupConfigController = async (req, res) => {
  try {
    const config = await getBackupConfig();
    res.json(config);
  } catch (err) {
    console.error('getBackupConfig error:', err);
    res.status(500).json({ message: 'Error retrieving backup settings.' });
  }
};

export const updateBackupConfigController = async (req, res) => {
  try {
    const { autoBackupEnabled, intervalHours } = req.body;
    const updated = await updateBackupConfig({ autoBackupEnabled, intervalHours }, req.user);
    res.json(updated);
  } catch (err) {
    console.error('updateBackupConfig error:', err);
    res.status(500).json({ message: 'Error updating backup settings.' });
  }
};

export const getLogsController = async (req, res) => {
  try {
    const { category, search, limit } = req.query;
    const logs = await getLogs({
      category,
      search,
      limit: limit ? parseInt(limit, 10) : 200
    });
    res.json({ logs });
  } catch (err) {
    console.error('getLogs error:', err);
    res.status(500).json({ message: 'Error retrieving activity logs.' });
  }
};

export const undoLogController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await undoLogEntry(id, req.user);
    res.json({ success: true, message: 'Action undone successfully.', log: result });
  } catch (err) {
    console.error('undoLog error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Error performing undo.' });
  }
};

/* ============================================================
   SMTP Configuration & Testing
   ============================================================ */
export const getSmtpConfigController = async (req, res) => {
  try {
    let config = await Config.findOne({ key: 'app' });
    const dbSmtp = config?.smtpConfig || {};
    const envHost = process.env.SMTP_HOST || '';
    const envUser = process.env.SMTP_USER || '';

    res.json({
      host: dbSmtp.host || envHost,
      port: Number(dbSmtp.port) || (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587),
      secure: dbSmtp.secure !== undefined ? Boolean(dbSmtp.secure) : (process.env.SMTP_SECURE === 'true'),
      user: dbSmtp.user || envUser,
      from: dbSmtp.from || process.env.SMTP_FROM || '',
      hasPass: Boolean(dbSmtp.pass || process.env.SMTP_PASS),
      isFromEnv: !dbSmtp.host && Boolean(envHost)
    });
  } catch (err) {
    console.error('getSmtpConfig error:', err);
    res.status(500).json({ message: 'Error retrieving SMTP configuration.' });
  }
};

export const updateSmtpConfigController = async (req, res) => {
  try {
    const { host, port, secure, user, pass, from } = req.body;
    let config = await Config.findOne({ key: 'app' });
    if (!config) config = new Config({ key: 'app' });
    if (!config.smtpConfig) config.smtpConfig = {};

    if (host !== undefined) config.smtpConfig.host = (host || '').trim();
    if (port !== undefined) config.smtpConfig.port = Number(port) || 587;
    if (secure !== undefined) config.smtpConfig.secure = Boolean(secure);
    if (user !== undefined) config.smtpConfig.user = (user || '').trim();
    if (pass && pass.trim()) config.smtpConfig.pass = pass.trim();
    if (from !== undefined) config.smtpConfig.from = (from || '').trim();

    await config.save();

    await recordLog({
      action: 'update_smtp_config',
      category: 'admin',
      actor: req.user,
      details: `Updated SMTP email configuration (Host: ${config.smtpConfig.host || 'none'}, User: ${config.smtpConfig.user || 'none'})`,
      targetId: 'smtp',
      targetType: 'config',
      canUndo: false
    });

    res.json({
      success: true,
      message: 'SMTP configuration saved successfully.',
      config: {
        host: config.smtpConfig.host,
        port: config.smtpConfig.port,
        secure: config.smtpConfig.secure,
        user: config.smtpConfig.user,
        from: config.smtpConfig.from,
        hasPass: Boolean(config.smtpConfig.pass)
      }
    });
  } catch (err) {
    console.error('updateSmtpConfig error:', err);
    res.status(500).json({ message: 'Error updating SMTP configuration.' });
  }
};

export const testSmtpController = async (req, res) => {
  try {
    const { host, port, secure, user, pass, from, testEmail } = req.body;
    let targetConfig = null;

    if (host && user) {
      let testPass = pass;
      if (!testPass) {
        const config = await Config.findOne({ key: 'app' });
        testPass = config?.smtpConfig?.pass || process.env.SMTP_PASS || '';
      }
      targetConfig = {
        host: host.trim(),
        port: Number(port) || 587,
        secure: Boolean(secure),
        user: user.trim(),
        pass: testPass,
        from: from ? from.trim() : `"MyDeepwork" <${user.trim()}>`
      };
    }

    const result = await testSmtpConnection(targetConfig, testEmail || req.user.email);
    res.json({
      success: true,
      message: result.message + (testEmail ? ` Test email was sent to ${testEmail}.` : '')
    });
  } catch (err) {
    console.error('testSmtp error:', err);
    res.status(400).json({ message: `SMTP verification failed: ${err.message}` });
  }
};

/* ============================================================
   Reset Requests Management
   ============================================================ */
const WORDS = "amber,atlas,bloom,cedar,coral,delta,ember,fable,grove,harbor,indigo,juniper,lotus,maple,meadow,nova,orbit,pebble,quartz,river,saffron,summit,tango,tidal,velvet,willow,zephyr,canyon,falcon,lagoon".split(",");

const generateRandomPassword = () => {
  const w1 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const w2 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${w1}-${w2}-${num}`;
};

const generateRandomPin = () => {
  return String(Math.floor(1000 + Math.random() * 9000));
};

export const getResetRequestsController = async (req, res) => {
  try {
    const requests = await ResetRequest.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name username email role authType status');
    res.json({ requests });
  } catch (err) {
    console.error('getResetRequests error:', err);
    res.status(500).json({ message: 'Error retrieving reset requests.' });
  }
};

export const acceptResetRequestController = async (req, res) => {
  try {
    const { id } = req.params;
    const { newCred: customCred, adminNote } = req.body;

    const request = await ResetRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Reset request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `This request has already been ${request.status}.` });
    }

    // Locate the target user
    let user = null;
    if (request.user) {
      user = await User.findById(request.user);
    }
    if (!user && request.username) {
      user = await User.findOne({ username: request.username.toLowerCase() });
    }
    if (!user && request.email) {
      user = await User.findOne({ email: request.email.toLowerCase() });
    }
    if (!user && request.identifier) {
      const safeRegex = request.identifier.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      user = await User.findOne({
        $or: [
          { username: request.identifier.trim().toLowerCase() },
          { name: new RegExp(`^${safeRegex}$`, 'i') }
        ]
      });
    }

    if (!user) {
      return res.status(404).json({
        message: `No matching user account found for "${request.name || request.username || request.identifier}".`
      });
    }

    const salt = await bcrypt.genSalt(10);
    let newCred = '';

    if (request.type === 'pin') {
      newCred = (customCred && /^\d{4}$/.test(String(customCred).trim()))
        ? String(customCred).trim()
        : generateRandomPin();

      user.pinHash = await bcrypt.hash(newCred, salt);
      user.authType = 'pin';
    } else {
      newCred = (customCred && String(customCred).trim().length >= 8)
        ? String(customCred).trim()
        : generateRandomPassword();

      user.passwordHash = await bcrypt.hash(newCred, salt);
      user.authType = 'password';
    }

    // If user didn't have an email on record or request provided email, update user email
    if (request.email && !user.email) {
      user.email = request.email.toLowerCase();
    }
    await user.save();

    request.user = user._id;
    request.status = 'accepted';
    request.newCredGenerated = newCred;
    request.resolvedBy = req.user.username;
    request.resolvedAt = new Date();
    if (adminNote) {
      request.adminNote = adminNote.trim();
    }
    await request.save();

    await recordLog({
      action: 'accept_reset_request',
      category: 'admin',
      actor: req.user,
      details: `Accepted ${request.type === 'pin' ? 'PIN' : 'password'} reset request for @${user.username} (${user.name}). Generated new ${request.type === 'pin' ? 'PIN' : 'password'}.`,
      targetId: user.username,
      targetType: 'user',
      canUndo: false
    });

    res.json({
      success: true,
      message: `${request.type === 'pin' ? 'PIN' : 'Password'} reset accepted successfully!`,
      newCred,
      request
    });
  } catch (err) {
    console.error('acceptResetRequest error:', err);
    res.status(500).json({ message: err.message || 'Error accepting reset request.' });
  }
};

export const declineResetRequestController = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    const request = await ResetRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Reset request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `This request has already been ${request.status}.` });
    }

    request.status = 'declined';
    request.adminNote = (adminNote || 'Declined by administrator').trim();
    request.resolvedBy = req.user.username;
    request.resolvedAt = new Date();
    await request.save();

    await recordLog({
      action: 'decline_reset_request',
      category: 'admin',
      actor: req.user,
      details: `Declined ${request.type === 'pin' ? 'PIN' : 'password'} reset request for ${request.name || request.username || request.identifier}.`,
      targetId: request.username || request.identifier,
      targetType: 'user',
      canUndo: false
    });

    res.json({
      success: true,
      message: 'Reset request declined.',
      request
    });
  } catch (err) {
    console.error('declineResetRequest error:', err);
    res.status(500).json({ message: err.message || 'Error declining reset request.' });
  }
};

export const deleteResetRequestController = async (req, res) => {
  try {
    const { id } = req.params;
    await ResetRequest.findByIdAndDelete(id);
    res.json({ success: true, message: 'Reset request deleted.' });
  } catch (err) {
    console.error('deleteResetRequest error:', err);
    res.status(500).json({ message: 'Error deleting reset request.' });
  }
};


