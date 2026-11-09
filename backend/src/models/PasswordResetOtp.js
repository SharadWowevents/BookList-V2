import mongoose from 'mongoose';

const passwordResetOtpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  otpHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index in MongoDB
  },
  attempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export const PasswordResetOtp = mongoose.model('PasswordResetOtp', passwordResetOtpSchema);
