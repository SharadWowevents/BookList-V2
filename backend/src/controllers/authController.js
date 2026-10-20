import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { List } from '../models/List.js';
import { Config } from '../models/Config.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mydeepwork_secret', {
    expiresIn: '30d'
  });
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Seed default lists for a brand-new user
const seedStarterBoard = async (userId) => {
  const t = s => ({ id: uid(), text: s, done: false, starred: false });
  const l1 = {
    userId,
    id: uid(),
    name: "Project Links",
    starred: false,
    order: 0,
    todos: [t("Live Tracker Link"), t("Online Project File Link"), t("Presentation Deck Link")]
  };
  const l2 = {
    userId,
    id: uid(),
    name: "This Week",
    starred: false,
    order: 1,
    todos: [t("Confirm venue walkthrough"), t("Send vendor shortlist")]
  };
  const l3 = {
    userId,
    id: uid(),
    name: "Ideas",
    starred: false,
    order: 2,
    todos: []
  };

  const created = await List.insertMany([l1, l2, l3]);
  return {
    lists: created.map(l => ({ id: l.id, name: l.name, starred: l.starred, todos: l.todos })),
    activeId: created[0].id
  };
};

export const pinLogin = async (req, res) => {
  try {
    const { name, pin } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!pin || !/^\d{4}$/.test(pin.trim())) {
      return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
    }

    const trimmedName = name.trim();
    const username = trimmedName.toLowerCase();

    // Check if system requires team login
    const config = await Config.findOne({ key: 'app' });
    if (config?.requireLogin) {
      const existing = await User.findOne({ username });
      if (!existing || existing.role !== 'admin') {
        return res.status(403).json({
          message: 'Sign-in is required. Please use your team username and password.'
        });
      }
    }

    let user = await User.findOne({ username });

    if (user) {
      if (user.authType === 'pin' && user.pinHash) {
        const isMatch = await bcrypt.compare(pin.trim(), user.pinHash);
        if (!isMatch) {
          return res.status(400).json({ message: "That PIN doesn't match this name. Try again." });
        }
      } else if (user.authType === 'password') {
        return res.status(400).json({
          message: 'This account uses a password. Please sign in with the team login form.'
        });
      }

      user.lastSeen = new Date();
      await user.save();
    } else {
      // Create new user with PIN
      const salt = await bcrypt.genSalt(10);
      const pinHash = await bcrypt.hash(pin.trim(), salt);

      // Make first user admin automatically
      const userCount = await User.countDocuments();
      user = await User.create({
        username,
        name: trimmedName,
        authType: 'pin',
        pinHash,
        role: userCount === 0 ? 'admin' : 'member',
        status: 'active'
      });

      // Seed starter lists
      const seeded = await seedStarterBoard(user._id);
      user.activeId = seeded.activeId;
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        photo: user.photo,
        prefs: user.prefs,
        activeId: user.activeId,
        activeNoteId: user.activeNoteId,
        tab: user.tab
      }
    });
  } catch (err) {
    console.error('pinLogin error:', err);
    res.status(500).json({ message: 'Server error during sign in.' });
  }
};

export const teamLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const u = username.trim().toLowerCase();
    const user = await User.findOne({ username: u });

    if (!user || (!user.passwordHash && !user.pinHash)) {
      return res.status(400).json({ message: "That username and password don't match. Check them and try again." });
    }

    // Verify password or PIN
    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } else if (user.pinHash) {
      isMatch = await bcrypt.compare(password, user.pinHash);
    }

    if (!isMatch) {
      return res.status(400).json({ message: "That username and password don't match. Check them and try again." });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account is turned off. Ask your admin to turn it back on.' });
    }

    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        photo: user.photo,
        prefs: user.prefs,
        activeId: user.activeId,
        activeNoteId: user.activeNoteId,
        tab: user.tab
      }
    });
  } catch (err) {
    console.error('teamLogin error:', err);
    res.status(500).json({ message: 'Server error during team sign in.' });
  }
};

export const getMe = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role,
      photo: req.user.photo,
      prefs: req.user.prefs,
      activeId: req.user.activeId,
      activeNoteId: req.user.activeNoteId,
      tab: req.user.tab
    }
  });
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { name, photo, prefs, activeId, activeNoteId, tab } = req.body;

    if (name) user.name = name.trim();
    if (photo !== undefined) user.photo = photo;
    if (prefs) user.prefs = { ...user.prefs, ...prefs };
    if (activeId !== undefined) user.activeId = activeId;
    if (activeNoteId !== undefined) user.activeNoteId = activeNoteId;
    if (tab && ['lists', 'notes'].includes(tab)) user.tab = tab;

    await user.save();

    res.json({
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        photo: user.photo,
        prefs: user.prefs,
        activeId: user.activeId,
        activeNoteId: user.activeNoteId,
        tab: user.tab
      }
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
};

