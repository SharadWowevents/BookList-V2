import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mydeepwork_secret');
    const user = await User.findById(decoded.id).select('-pinHash -passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'Account not found. Please sign in again.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account has been turned off. Contact your admin.' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session token.' });
  }
};

export const optionalAuth = async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mydeepwork_secret');
      const user = await User.findById(decoded.id).select('-pinHash -passwordHash');
      if (user && user.status === 'active') {
        req.user = user;
      }
    } catch {}
  }
  next();
};

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required.' });
  }
};

export const crmOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.crm)) {
    next();
  } else {
    res.status(403).json({ message: 'CRM access required. Contact your admin.' });
  }
};

export const authMiddleware = protect;
