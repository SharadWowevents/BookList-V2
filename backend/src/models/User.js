import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  authType: {
    type: String,
    enum: ['pin', 'password'],
    default: 'pin'
  },
  pinHash: {
    type: String,
    default: null
  },
  passwordHash: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'off'],
    default: 'active'
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member'
  },
  photo: {
    type: String,
    default: null
  },
  prefs: {
    accent: { type: String, default: 'green' },
    theme: { type: String, default: 'auto' },
    collapsed: { type: Boolean, default: false }
  },
  activeId: {
    type: String,
    default: null
  },
  activeNoteId: {
    type: String,
    default: null
  },
  tab: {
    type: String,
    enum: ['lists', 'notes'],
    default: 'lists'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export const User = mongoose.model('User', userSchema);

