import mongoose from 'mongoose';

const configSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'app'
  },
  requireLogin: {
    type: Boolean,
    default: false
  },
  backupConfig: {
    autoBackupEnabled: {
      type: Boolean,
      default: true
    },
    intervalHours: {
      type: Number,
      default: 24
    },
    lastAutoBackup: {
      type: Date,
      default: null
    }
  },
  smtpConfig: {
    host: { type: String, default: '' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, default: '' },
    pass: { type: String, default: '' },
    from: { type: String, default: '' }
  }
}, {
  timestamps: true
});

export const Config = mongoose.model('Config', configSchema);
