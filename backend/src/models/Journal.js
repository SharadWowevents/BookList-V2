import mongoose from 'mongoose';

const journalEntrySchema = new mongoose.Schema({
  t: {
    type: String,
    default: '',
    maxlength: 300
  },
  img: {
    type: String,
    default: ''
  },
  mood: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const journalYearSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  entries: {
    type: Map,
    of: journalEntrySchema,
    default: {}
  }
}, {
  timestamps: true
});

journalYearSchema.index({ userId: 1, year: 1 }, { unique: true });

const journalPhotoSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  data: {
    type: Buffer,
    required: true
  },
  contentType: {
    type: String,
    default: 'image/jpeg'
  },
  filename: {
    type: String,
    default: 'photo.jpg'
  },
  size: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export const JournalYear = mongoose.model('JournalYear', journalYearSchema);
export const JournalPhoto = mongoose.model('JournalPhoto', journalPhotoSchema);

