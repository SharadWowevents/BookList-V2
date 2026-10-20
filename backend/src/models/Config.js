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
  }
}, {
  timestamps: true
});

export const Config = mongoose.model('Config', configSchema);

