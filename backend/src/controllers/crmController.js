import { CrmMember } from '../models/CrmMember.js';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const PLANS = ["Boardroom", "QBR", "FT 1", "FT 2", "FT 3", "FT Continuity", "Alumni"];
const SESSION_TYPES = ["Session", "MoM", "Review", "Call"];

// Helper to sanitize member payload
const sanitizeMemberInput = (d, defaultId = null) => {
  d = d || {};
  return {
    id: (d.id || defaultId || uid()).toString().slice(0, 60),
    name: (d.name || '').trim().slice(0, 80),
    mobile: (d.mobile || '').trim().slice(0, 20),
    plan: PLANS.includes(d.plan) ? d.plan : PLANS[0],
    start: /^\d{4}-\d{2}-\d{2}$/.test(d.start) ? d.start : '',
    end: /^\d{4}-\d{2}-\d{2}$/.test(d.end) ? d.end : '',
    comment: (d.comment || '').slice(0, 2000),
    photo: typeof d.photo === 'string' && d.photo.startsWith('data:image/') ? d.photo : (d.photo || ''),
    followUps: Array.isArray(d.followUps)
      ? d.followUps.slice(0, 200).filter(f => f && typeof f === 'object').map(f => ({
          id: (f.id || uid()).toString().slice(0, 40),
          date: /^\d{4}-\d{2}-\d{2}$/.test(f.date) ? f.date : '',
          note: (f.note || '').slice(0, 500),
          done: !!f.done,
          by: (f.by || '').slice(0, 80),
          byName: (f.byName || '').slice(0, 80)
        }))
      : []
  };
};

// GET /api/crm/members
export const getMembers = async (req, res) => {
  try {
    const members = await CrmMember.find({}).sort({ end: 1, name: 1 });
    res.json({ members });
  } catch (err) {
    console.error('getMembers error:', err);
    res.status(500).json({ message: 'Error loading CRM members.' });
  }
};

// GET /api/crm/members/:id
export const getMemberById = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await CrmMember.findOne({ id });
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }
    res.json({ member });
  } catch (err) {
    console.error('getMemberById error:', err);
    res.status(500).json({ message: 'Error retrieving member.' });
  }
};

// POST /api/crm/members
export const createMember = async (req, res) => {
  try {
    const clean = sanitizeMemberInput(req.body);
    if (!clean.name) {
      return res.status(400).json({ message: "Member name is required." });
    }

    const digits = clean.mobile.replace(/\D/g, '');
    if (clean.mobile && (digits.length < 7 || digits.length > 15)) {
      return res.status(400).json({ message: "Enter a valid mobile number, for example 98100 12345." });
    }

    if (clean.start && clean.end && clean.end < clean.start) {
      return res.status(400).json({ message: "The end date is before the start date." });
    }

    const now = Date.now();
    const newMember = new CrmMember({
      ...clean,
      sessions: [],
      lastSession: '',
      sessionCount: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: req.user?.username || '',
      updatedByName: req.user?.name || ''
    });

    await newMember.save();
    res.status(201).json({ member: newMember });
  } catch (err) {
    console.error('createMember error:', err);
    res.status(500).json({ message: 'Error creating CRM member.' });
  }
};

// PUT /api/crm/members/:id
export const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await CrmMember.findOne({ id });
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    const clean = sanitizeMemberInput(req.body, id);
    if (!clean.name) {
      return res.status(400).json({ message: "Member name is required." });
    }

    const digits = clean.mobile.replace(/\D/g, '');
    if (clean.mobile && (digits.length < 7 || digits.length > 15)) {
      return res.status(400).json({ message: "Enter a valid mobile number, for example 98100 12345." });
    }

    if (clean.start && clean.end && clean.end < clean.start) {
      return res.status(400).json({ message: "The end date is before the start date." });
    }

    member.name = clean.name;
    member.mobile = clean.mobile;
    member.plan = clean.plan;
    member.start = clean.start;
    member.end = clean.end;
    member.comment = clean.comment;
    if (req.body.photo !== undefined) {
      member.photo = clean.photo;
    }
    member.followUps = clean.followUps;

    // Recalculate session stats from existing sessions
    const sessions = member.sessions || [];
    member.sessionCount = sessions.length;
    member.lastSession = sessions.reduce((latest, s) => (s.date > latest ? s.date : latest), '');

    member.updatedAt = Date.now();
    member.updatedBy = req.user?.username || '';
    member.updatedByName = req.user?.name || '';

    await member.save();
    res.json({ member });
  } catch (err) {
    console.error('updateMember error:', err);
    res.status(500).json({ message: 'Error updating CRM member.' });
  }
};

// DELETE /api/crm/members/:id
export const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await CrmMember.findOne({ id });
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    await CrmMember.deleteOne({ id });
    res.json({ message: `Member ${member.name} deleted successfully.` });
  } catch (err) {
    console.error('deleteMember error:', err);
    res.status(500).json({ message: 'Error deleting CRM member.' });
  }
};

// GET /api/crm/members/:id/sessions
export const getMemberSessions = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await CrmMember.findOne({ id });
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    const sessions = (member.sessions || []).slice().sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    res.json({ sessions });
  } catch (err) {
    console.error('getMemberSessions error:', err);
    res.status(500).json({ message: 'Error loading session notes.' });
  }
};

// POST /api/crm/members/:id/sessions
export const addMemberSession = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await CrmMember.findOne({ id });
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    const { date, type, text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Session note text is required.' });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Valid session date is required.' });
    }

    const now = Date.now();
    const newSession = {
      id: uid(),
      date,
      type: SESSION_TYPES.includes(type) ? type : 'Session',
      text: text.trim().slice(0, 10000),
      by: req.user?.username || '',
      byName: req.user?.name || '',
      createdAt: now,
      updatedAt: now
    };

    member.sessions.push(newSession);
    member.sessionCount = member.sessions.length;
    member.lastSession = member.sessions.reduce((latest, s) => (s.date > latest ? s.date : latest), '');
    member.updatedAt = now;
    member.updatedBy = req.user?.username || '';
    member.updatedByName = req.user?.name || '';

    await member.save();
    res.status(201).json({ session: newSession, member });
  } catch (err) {
    console.error('addMemberSession error:', err);
    res.status(500).json({ message: 'Error adding session note.' });
  }
};

// PUT /api/crm/members/:id/sessions/:sessionId
export const updateMemberSession = async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const member = await CrmMember.findOne({ id });
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    const sess = member.sessions.find(s => s.id === sessionId);
    if (!sess) {
      return res.status(404).json({ message: 'Session note not found.' });
    }

    const { date, type, text } = req.body;
    if (text !== undefined) {
      if (!text.trim()) {
        return res.status(400).json({ message: "A note can't be empty. Delete it instead." });
      }
      sess.text = text.trim().slice(0, 10000);
    }
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sess.date = date;
    }
    if (type && SESSION_TYPES.includes(type)) {
      sess.type = type;
    }
    sess.updatedAt = Date.now();

    member.sessionCount = member.sessions.length;
    member.lastSession = member.sessions.reduce((latest, s) => (s.date > latest ? s.date : latest), '');
    member.updatedAt = Date.now();
    member.updatedBy = req.user?.username || '';
    member.updatedByName = req.user?.name || '';

    await member.save();
    res.json({ session: sess, member });
  } catch (err) {
    console.error('updateMemberSession error:', err);
    res.status(500).json({ message: 'Error updating session note.' });
  }
};

// DELETE /api/crm/members/:id/sessions/:sessionId
export const deleteMemberSession = async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const member = await CrmMember.findOne({ id });
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    member.sessions = member.sessions.filter(s => s.id !== sessionId);
    member.sessionCount = member.sessions.length;
    member.lastSession = member.sessions.reduce((latest, s) => (s.date > latest ? s.date : latest), '');
    member.updatedAt = Date.now();
    member.updatedBy = req.user?.username || '';
    member.updatedByName = req.user?.name || '';

    await member.save();
    res.json({ message: 'Session note deleted.', member });
  } catch (err) {
    console.error('deleteMemberSession error:', err);
    res.status(500).json({ message: 'Error deleting session note.' });
  }
};

