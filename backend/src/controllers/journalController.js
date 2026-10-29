import crypto from 'crypto';
import { JournalYear, JournalPhoto } from '../models/Journal.js';

const MOODS = ['😄', '🙂', '😌', '🙏', '🥳', '😐', '😴', '😔', '😢', '😠', '😰', '🤒'];
const MOOD_SET = new Set(MOODS);

const normEntry = (entry = {}) => {
  const t = typeof entry.t === 'string' ? entry.t.slice(0, 300) : '';
  const img = typeof entry.img === 'string' ? entry.img.trim() : '';
  const mood = MOOD_SET.has(entry.mood) ? entry.mood : '';
  return { t, img, mood };
};

export const getYears = async (req, res) => {
  try {
    const userId = req.user._id;
    const yearList = (req.query.years || '')
      .split(',')
      .map(y => parseInt(y.trim(), 10))
      .filter(y => !isNaN(y) && y > 1900 && y < 3000);

    const query = { userId };
    if (yearList.length > 0) {
      query.year = { $in: yearList };
    }

    const docs = await JournalYear.find(query).lean();
    const result = {};

    for (const doc of docs) {
      const entriesObj = {};
      if (doc.entries) {
        // Mongoose Map or POJO
        const entriesMap = doc.entries instanceof Map ? Object.fromEntries(doc.entries) : doc.entries;
        for (const [k, v] of Object.entries(entriesMap)) {
          if (v) entriesObj[k] = normEntry(v);
        }
      }
      result[doc.year] = {
        year: doc.year,
        entries: entriesObj
      };
    }

    res.json({ years: result });
  } catch (err) {
    console.error('getYears error:', err);
    res.status(500).json({ message: 'Error retrieving journal years.' });
  }
};

export const getYear = async (req, res) => {
  try {
    const userId = req.user._id;
    const year = parseInt(req.params.year, 10);
    if (isNaN(year)) {
      return res.status(400).json({ message: 'Invalid year.' });
    }

    const doc = await JournalYear.findOne({ userId, year }).lean();
    const entriesObj = {};
    if (doc && doc.entries) {
      const entriesMap = doc.entries instanceof Map ? Object.fromEntries(doc.entries) : doc.entries;
      for (const [k, v] of Object.entries(entriesMap)) {
        if (v) entriesObj[k] = normEntry(v);
      }
    }

    res.json({
      year,
      entries: entriesObj
    });
  } catch (err) {
    console.error('getYear error:', err);
    res.status(500).json({ message: 'Error retrieving journal entries for year.' });
  }
};

export const patchEntry = async (req, res) => {
  try {
    const userId = req.user._id;
    const year = parseInt(req.params.year, 10);
    const dateKey = String(req.params.dateKey || '').trim();

    if (isNaN(year) || !/^\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ message: 'Invalid year or date format (expected YYYY and MM-DD).' });
    }

    let doc = await JournalYear.findOne({ userId, year });
    if (!doc) {
      doc = new JournalYear({
        userId,
        year,
        entries: new Map()
      });
    }

    // Get current entry or init
    const current = (doc.entries && typeof doc.entries.get === 'function'
      ? doc.entries.get(dateKey)
      : doc.entries?.[dateKey]) || {};

    const incoming = req.body || {};
    const updated = {
      t: incoming.t !== undefined ? String(incoming.t).slice(0, 300) : (current.t || ''),
      img: incoming.img !== undefined ? String(incoming.img).trim() : (current.img || ''),
      mood: incoming.mood !== undefined ? (MOOD_SET.has(incoming.mood) ? incoming.mood : '') : (current.mood || ''),
      updatedAt: new Date()
    };

    if (typeof doc.entries.set === 'function') {
      doc.entries.set(dateKey, updated);
    } else {
      if (!doc.entries) doc.entries = {};
      doc.entries[dateKey] = updated;
    }

    doc.markModified('entries');
    await doc.save();

    res.json({
      success: true,
      year,
      dateKey,
      entry: normEntry(updated)
    });
  } catch (err) {
    console.error('patchEntry error:', err);
    res.status(500).json({ message: 'Error updating journal entry.' });
  }
};

export const uploadPhoto = async (req, res) => {
  try {
    let buffer = null;
    let contentType = 'image/jpeg';
    let filename = 'photo.jpg';

    if (req.body && typeof req.body === 'object' && req.body.data) {
      const rawData = String(req.body.data);
      const base64Data = rawData.includes(';base64,') ? rawData.split(';base64,')[1] : rawData;
      buffer = Buffer.from(base64Data, 'base64');
      if (req.body.type) contentType = req.body.type;
      if (req.body.name) filename = req.body.name;
    } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      buffer = req.body;
      const headerType = req.headers['content-type'];
      if (headerType && !headerType.includes('multipart/')) {
        contentType = headerType.split(';')[0];
      }
      if (req.query.name) filename = req.query.name;
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ message: 'No image data received.' });
    }

    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({ message: 'Image too large. Max size is 15MB.' });
    }

    const id = 'jimg_' + crypto.randomBytes(10).toString('hex');
    const photoDoc = await JournalPhoto.create({
      id,
      userId: req.user?._id || null,
      data: buffer,
      contentType,
      filename,
      size: buffer.length
    });

    res.json({
      success: true,
      id: photoDoc.id,
      src: `/api/journal/photo/${photoDoc.id}`,
      size: photoDoc.size
    });
  } catch (err) {
    console.error('uploadPhoto error:', err);
    res.status(500).json({ message: 'Failed to upload photo.' });
  }
};

export const getPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await JournalPhoto.findOne({ id });
    if (!photo || !photo.data) {
      return res.status(404).send('Photo not found');
    }

    res.setHeader('Content-Type', photo.contentType || 'image/jpeg');
    res.setHeader('Content-Length', photo.data.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(photo.data);
  } catch (err) {
    console.error('getPhoto error:', err);
    res.status(500).send('Error retrieving photo');
  }
};

export const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    await JournalPhoto.deleteOne({ id });
    res.json({ success: true });
  } catch (err) {
    console.error('deletePhoto error:', err);
    res.status(500).json({ message: 'Error deleting photo.' });
  }
};
