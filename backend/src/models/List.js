import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  text: {
    type: String,
    default: '',
    trim: true
  },
  done: {
    type: Boolean,
    default: false
  },
  starred: {
    type: Boolean,
    default: false
  },
  audio: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { _id: false });

const listSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    default: 'Untitled list',
    trim: true
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
  },
  todos: [todoSchema]
}, {
  timestamps: true
});

listSchema.index({ userId: 1, id: 1 }, { unique: true });

export const List = mongoose.model('List', listSchema);

