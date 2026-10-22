import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['lists', 'notes', 'crm', 'backup', 'admin'],
    default: 'lists',
    index: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  actorUsername: {
    type: String,
    default: ''
  },
  actorName: {
    type: String,
    default: ''
  },
  details: {
    type: String,
    required: true
  },
  targetId: {
    type: String,
    default: ''
  },
  targetType: {
    type: String,
    default: ''
  },
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  canUndo: {
    type: Boolean,
    default: false
  },
  isUndone: {
    type: Boolean,
    default: false,
    index: true
  },
  undoneAt: {
    type: Date,
    default: null
  },
  undoneBy: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Capacity limit: Max 200 logs
export const MAX_AUDIT_LOGS = 200;

export async function pruneAuditLogs(limit = MAX_AUDIT_LOGS) {
  try {
    const count = await AuditLog.countDocuments();
    if (count > limit) {
      const excess = await AuditLog.find()
        .sort({ createdAt: 1 })
        .limit(count - limit)
        .select('_id');
      if (excess.length > 0) {
        await AuditLog.deleteMany({ _id: { $in: excess.map(l => l._id) } });
      }
    }
  } catch (err) {
    console.error('Error pruning audit logs:', err);
  }
}

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
