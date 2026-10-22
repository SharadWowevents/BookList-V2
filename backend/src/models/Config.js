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
  }
}, {
  timestamps: true
});

export const Config = mongoose.model('Config', configSchema);
