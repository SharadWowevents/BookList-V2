import mongoose from 'mongoose';

const shareSchema = new mongoose.Schema({
  sid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  itemId: {
    type: String,
    required: true
  },
  kind: {
    type: String,
    enum: ['list', 'note'],
    required: true
  },
  mode: {
    type: String,
    enum: ['edit', 'view'],
    default: 'edit'
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  updatedBy: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export const Share = mongoose.model('Share', shareSchema);

