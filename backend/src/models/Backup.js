import mongoose from 'mongoose';

const backupSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['manual', 'auto'],
    default: 'manual',
    index: true
  },
  label: {
    type: String,
    default: ''
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  createdByName: {
    type: String,
    default: ''
  },
  counts: {
    lists: { type: Number, default: 0 },
    notes: { type: Number, default: 0 },
    crmMembers: { type: Number, default: 0 },
    users: { type: Number, default: 0 }
  },
  size: {
    type: Number,
    default: 0
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

// Capacity limit: Max 5 backups
export const MAX_BACKUPS = 5;

export async function pruneBackups(limit = MAX_BACKUPS) {
  try {
    const count = await Backup.countDocuments();
    if (count > limit) {
      const excess = await Backup.find()
        .sort({ createdAt: 1 })
        .limit(count - limit)
        .select('_id');
      if (excess.length > 0) {
        await Backup.deleteMany({ _id: { $in: excess.map(b => b._id) } });
      }
    }
  } catch (err) {
    console.error('Error pruning backups:', err);
  }
}

export const Backup = mongoose.model('Backup', backupSchema);
