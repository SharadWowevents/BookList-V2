import mongoose from 'mongoose';

const audioFileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  data: {
    type: Buffer,
    required: true
  },
  contentType: {
    type: String,
    default: 'audio/webm'
  },
  filename: {
    type: String,
    default: 'audio-note.webm'
  },
  size: {
    type: Number,
    default: 0
  },
  dur: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export const AudioFile = mongoose.model('AudioFile', audioFileSchema);
