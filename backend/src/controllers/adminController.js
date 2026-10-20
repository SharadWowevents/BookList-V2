import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { Config } from '../models/Config.js';

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

    res.status(201).json({
      u: newUser.username,
      name: newUser.name,
      status: newUser.status,
      role: newUser.role,
      createdAt: newUser.createdAt
    });
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ message: 'Error creating team user.' });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.status = user.status === 'active' ? 'off' : 'active';
    await user.save();

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

    // Clean up user's data
    await List.deleteMany({ userId: user._id });
    await Note.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });

    res.json({ message: `User ${user.name || username} deleted.` });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ message: 'Error deleting user.' });
  }
};

