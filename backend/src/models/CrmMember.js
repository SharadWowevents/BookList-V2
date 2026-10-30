import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema({
  id: { type: String, required: true },
  date: { type: String, default: '' }, // YYYY-MM-DD
  note: { type: String, default: '' },
  done: { type: Boolean, default: false },
  by: { type: String, default: '' },
  byName: { type: String, default: '' }
}, { _id: false });

const sessionNoteSchema = new mongoose.Schema({
  id: { type: String, required: true },
  date: { type: String, default: '' }, // YYYY-MM-DD
  type: {
    type: String,
    enum: ['Session', 'MoM', 'Review', 'Call'],
    default: 'Session'
  },
  text: { type: String, default: '' },
  by: { type: String, default: '' },
  byName: { type: String, default: '' },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
}, { _id: false });

const crmMemberSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true },
  linkedin: { type: String, default: '', trim: true },
  label: {
    type: String,
    enum: ['bleeding', 'slipping', 'stable', 'leading', ''],
    default: ''
  },
  plan: {
    type: String,
    enum: ["Boardroom", "QBR", "FT 1", "FT 2", "FT 3", "FT Continuity", "Alumni"],
    default: "Boardroom"
  },
  start: { type: String, default: '' },
  end: { type: String, default: '' },
  comment: { type: String, default: '' },
  photo: { type: String, default: '' },
  followUps: [followUpSchema],
  sessions: [sessionNoteSchema],
  lastSession: { type: String, default: '' },
  sessionCount: { type: Number, default: 0 },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
  updatedBy: { type: String, default: '' },
  updatedByName: { type: String, default: '' }
}, {
  timestamps: true
});

export const CrmMember = mongoose.model('CrmMember', crmMemberSchema);

