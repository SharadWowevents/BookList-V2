import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { List } from '../models/List.js';
import { Config } from '../models/Config.js';
import { PasswordResetOtp } from '../models/PasswordResetOtp.js';
import { ResetRequest } from '../models/ResetRequest.js';
import { sendPasswordResetOtpEmail } from '../services/emailService.js';
import { recordLog } from '../services/auditLogService.js';
import { getOnlineUsernames, getAllUsersPresence } from '../services/websocketService.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mydeepwork_secret', {
    expiresIn: '30d'
  });
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 3))}${user.slice(-1)}@${domain}`;
};

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
        email: user.email || '',
        name: user.name,
        role: user.role,
        crm: !!user.crm,
        photo: user.photo,
        prefs: user.prefs,
        activeId: user.activeId,
        activeNoteId: user.activeNoteId,
        tab: user.tab,
        privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt || null
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
        email: user.email || '',
        name: user.name,
        role: user.role,
        crm: !!user.crm,
        photo: user.photo,
        prefs: user.prefs,
        activeId: user.activeId,
        activeNoteId: user.activeNoteId,
        tab: user.tab,
        privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt || null
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
      email: req.user.email || '',
      name: req.user.name,
      role: req.user.role,
      crm: !!req.user.crm,
      photo: req.user.photo,
      prefs: req.user.prefs,
      activeId: req.user.activeId,
      activeNoteId: req.user.activeNoteId,
      tab: req.user.tab,
      privacyPolicyAcceptedAt: req.user.privacyPolicyAcceptedAt || null
    }
  });
};

export const acceptPrivacyPolicy = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.privacyPolicyAcceptedAt = new Date();
    user.privacyPolicyVersion = req.body?.version || '2023-dpdp-v1';
    await user.save();

    res.json({
      success: true,
      message: 'Privacy policy accepted.',
      privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt,
      privacyPolicyVersion: user.privacyPolicyVersion
    });
  } catch (err) {
    console.error('acceptPrivacyPolicy error:', err);
    res.status(500).json({ message: 'Error saving privacy policy acceptance.' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { name, email, photo, prefs, activeId, activeNoteId, tab } = req.body;

    if (name) user.name = name.trim();
    if (email !== undefined) {
      const e = (email || '').trim().toLowerCase();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        return res.status(400).json({ message: 'Invalid email address.' });
      }
      user.email = e || null;
    }
    if (photo !== undefined) user.photo = photo;
    if (prefs) user.prefs = { ...user.prefs, ...prefs };
    if (activeId !== undefined) user.activeId = activeId;
    if (activeNoteId !== undefined) user.activeNoteId = activeNoteId;
    if (tab && ['lists', 'notes', 'crm'].includes(tab)) user.tab = tab;

    await user.save();

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email || '',
        name: user.name,
        role: user.role,
        crm: !!user.crm,
        photo: user.photo,
        prefs: user.prefs,
        activeId: user.activeId,
        activeNoteId: user.activeNoteId,
        tab: user.tab,
        privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt || null
      }
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
};

/**
 * Request OTP verification code for forgotten password or PIN via SMTP
 */
export const requestPasswordResetOtp = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ message: 'Please enter your name, username, or registered email.' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const safeRegex = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      $or: [
        { username: cleanId },
        { email: cleanId },
        { name: new RegExp(`^${safeRegex}$`, 'i') }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'No account found matching that name, username, or email.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact your administrator.' });
    }

    if (!user.email || !user.email.includes('@')) {
      const idLabel = user.name || `@${user.username}`;
      return res.status(400).json({
        message: `No recovery email address is linked to account "${idLabel}". Please ask an administrator to add an email or reset your credentials.`
      });
    }

    // Rate-limit: 1 request per 60 seconds
    const recentOtp = await PasswordResetOtp.findOne({
      userId: user._id,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }
    });
    if (recentOtp) {
      return res.status(429).json({
        message: 'A verification code was already sent recently. Please wait a minute before requesting another code.'
      });
    }

    // Generate cryptographically secure 6-digit numeric OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clear previous OTPs and record new one
    await PasswordResetOtp.deleteMany({ userId: user._id });
    await PasswordResetOtp.create({
      userId: user._id,
      username: user.username,
      email: user.email,
      otpHash,
      expiresAt,
      attempts: 0
    });

    const isPinAccount = user.authType === 'pin';

    // Send email via configured SMTP
    await sendPasswordResetOtpEmail({
      toEmail: user.email,
      userName: user.name || user.username,
      otpCode: rawOtp,
      minutesValid: 10,
      isPin: isPinAccount
    });

    const masked = maskEmail(user.email);
    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${masked}.`,
      username: user.username,
      name: user.name,
      authType: user.authType || 'password',
      email: masked
    });
  } catch (err) {
    console.error('requestPasswordResetOtp error:', err);
    res.status(500).json({
      message: err.message || 'Error sending verification code. Please check SMTP settings or try again.'
    });
  }
};

/**
 * Verify OTP and reset password or PIN
 */
export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const { username, otp, newPassword, newPin } = req.body;

    if (!username || !otp || (!newPassword && !newPin)) {
      return res.status(400).json({ message: 'Username, OTP verification code, and new credentials are required.' });
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ message: 'Verification code must be exactly 6 digits.' });
    }

    const user = await User.findOne({ username: cleanUser });
    if (!user) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    const isPinReset = Boolean(newPin || user.authType === 'pin');

    if (isPinReset) {
      const pinValue = String(newPin || newPassword).trim();
      if (!/^\d{4}$/.test(pinValue)) {
        return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
      }
    } else {
      if ((newPassword || '').length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
      }
    }

    const otpDoc = await PasswordResetOtp.findOne({
      userId: user._id,
      expiresAt: { $gt: new Date() }
    });

    if (!otpDoc) {
      return res.status(400).json({
        message: 'Verification code has expired or is invalid. Please request a new code.'
      });
    }

    if (otpDoc.attempts >= 5) {
      await PasswordResetOtp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        message: 'Too many incorrect attempts. For security, please request a new verification code.'
      });
    }

    const isMatch = await bcrypt.compare(cleanOtp, otpDoc.otpHash);
    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      return res.status(400).json({
        message: `Invalid verification code. ${remaining > 0 ? `${remaining} attempt${remaining > 1 ? 's' : ''} remaining.` : 'Please request a new code.'}`
      });
    }

    // Set new PIN or password
    const salt = await bcrypt.genSalt(10);
    if (isPinReset) {
      const pinValue = String(newPin || newPassword).trim();
      user.pinHash = await bcrypt.hash(pinValue, salt);
      user.authType = 'pin';
    } else {
      user.passwordHash = await bcrypt.hash(newPassword, salt);
      user.authType = 'password';
    }
    await user.save();

    // Clean up OTPs
    await PasswordResetOtp.deleteMany({ userId: user._id });

    // Record audit log
    await recordLog({
      action: isPinReset ? 'reset_pin_otp' : 'reset_password_otp',
      category: 'auth',
      actor: { username: user.username, name: user.name, role: user.role },
      details: `${isPinReset ? '4-digit PIN' : 'Password'} reset via email OTP for @${user.username}`,
      targetId: user.username,
      targetType: 'user',
      canUndo: false
    });

    res.json({
      success: true,
      authType: isPinReset ? 'pin' : 'password',
      username: user.username,
      name: user.name,
      message: `${isPinReset ? 'PIN' : 'Password'} reset successfully! You can now sign in with your new ${isPinReset ? 'PIN' : 'password'}.`
    });
  } catch (err) {
    console.error('verifyPasswordResetOtp error:', err);
    res.status(500).json({ message: err.message || 'Error resetting credentials.' });
  }
};

/* ============================================================
   Contact Admin Reset Request
   ============================================================ */
export const submitResetRequest = async (req, res) => {
  try {
    const { identifier, email, type = 'pin', note } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ message: 'Name or username is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const cleanId = identifier.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const safeRegex = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      $or: [
        { username: cleanId.toLowerCase() },
        { email: cleanEmail },
        { name: new RegExp(`^${safeRegex}$`, 'i') }
      ]
    });

    const requestDoc = await ResetRequest.create({
      user: user ? user._id : null,
      identifier: cleanId,
      username: user ? user.username : cleanId.toLowerCase().replace(/[^a-z0-9._-]/g, ''),
      name: user ? user.name : cleanId,
      email: cleanEmail,
      type: type === 'password' ? 'password' : 'pin',
      note: (note || '').trim(),
      status: 'pending'
    });

    res.json({
      success: true,
      message: 'Your reset request has been submitted to the administrator.',
      id: requestDoc._id
    });
  } catch (err) {
    console.error('submitResetRequest error:', err);
    res.status(500).json({ message: err.message || 'Error submitting reset query.' });
  }
};

export const getPresence = async (req, res) => {
  try {
    const users = await getAllUsersPresence();
    res.json({
      onlineUsers: getOnlineUsernames(),
      users
    });
  } catch (err) {
    console.error('getPresence error:', err);
    res.status(500).json({ message: 'Error fetching presence info.' });
  }
};



