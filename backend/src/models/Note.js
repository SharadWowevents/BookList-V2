import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  id: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    default: '',
    trim: true
  },
  html: {
    type: String,
    default: ''
  },
  starred: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  shared: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

noteSchema.index({ userId: 1, id: 1 }, { unique: true });

export const Note = mongoose.model('Note', noteSchema);

