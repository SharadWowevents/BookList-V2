import mongoose from 'mongoose';

const resetRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  identifier: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    default: '',
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  type: {
    type: String,
    enum: ['pin', 'password'],
    default: 'pin'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
    index: true
  },
  note: {
    type: String,
    default: '',
    trim: true
  },
  adminNote: {
    type: String,
    default: '',
    trim: true
  },
  resolvedBy: {
    type: String,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  newCredGenerated: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

export const ResetRequest = mongoose.model('ResetRequest', resetRequestSchema);
