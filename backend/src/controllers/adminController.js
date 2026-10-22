import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { Config } from '../models/Config.js';
import { Share } from '../models/Share.js';
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
        status: u.status,
        role: u.role,
        crm: !!u.crm,
        authType: u.authType,
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
    const { name, username, password } = req.body;

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

    const existing = await User.findOne({ username: u });
    if (existing) {
      return res.status(400).json({ message: `“${u}” is already taken. Try another username.` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username: u,
      name: name.trim(),
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
      status: newUser.status,
      role: newUser.role,
      crm: !!newUser.crm,
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
      crm: user.crm
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
      status: user.status
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
    const { name, newUsername } = req.body;

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
        status: user.status,
        role: user.role,
        crm: !!user.crm,
        authType: user.authType,
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
