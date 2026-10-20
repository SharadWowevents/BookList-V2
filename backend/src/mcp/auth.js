import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';

export class McpAuthManager {
  constructor() {
    this.currentUser = null;
  }

  async authenticate(identifier, secret) {
    if (!identifier || !secret) {
      return { success: false, error: 'Both username/ID and password/PIN are required.' };
    }

    const idStr = String(identifier).trim().toLowerCase();
    const secretStr = String(secret).trim();

    try {
      // Find user by username, display name, or ObjectId
      let user = await User.findOne({ username: idStr });
      if (!user) {
        user = await User.findOne({ name: new RegExp('^' + idStr + '$', 'i') });
      }
      if (!user && mongoose.Types.ObjectId.isValid(identifier)) {
        user = await User.findById(identifier);
      }

      if (!user) {
        return { success: false, error: `User "${identifier}" not found in User DB.` };
      }

      if (user.status !== 'active') {
        return { success: false, error: `User account "${user.username}" is turned off.` };
      }

      // Check password or PIN hash
      let isMatch = false;
      if (user.passwordHash) {
        isMatch = await bcrypt.compare(secretStr, user.passwordHash);
      }
      if (!isMatch && user.pinHash) {
        isMatch = await bcrypt.compare(secretStr, user.pinHash);
      }

      if (!isMatch) {
        return { success: false, error: 'Invalid password or PIN for this account.' };
      }

      // Update last seen
      user.lastSeen = new Date();
      await user.save();

      this.currentUser = user;
      return {
        success: true,
        user: {
          id: user._id.toString(),
          username: user.username,
          name: user.name,
          role: user.role,
          authType: user.authType,
          tab: user.tab || 'lists'
        }
      };
    } catch (err) {
      console.error('[MCP Auth] Error during authentication:', err);
      return { success: false, error: `Authentication error: ${err.message}` };
    }
  }

  logout() {
    const prev = this.currentUser?.username;
    this.currentUser = null;
    return { success: true, message: prev ? `Logged out user ${prev}.` : 'No active session.' };
  }

  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  requireAuth() {
    if (!this.currentUser) {
      throw new Error(
        'Authentication required. Please use the "login" tool with your username and password, ' +
        'or configure BOOKLIST_USERNAME and BOOKLIST_PASSWORD in your environment.'
      );
    }
    return this.currentUser;
  }

  requireAdmin() {
    const user = this.requireAuth();
    if (user.role !== 'admin') {
      throw new Error(`Admin privileges required. User "${user.username}" is not an admin.`);
    }
    return user;
  }
}

