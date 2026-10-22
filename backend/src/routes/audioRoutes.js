import express from 'express';
import crypto from 'crypto';
import { AudioFile } from '../models/AudioFile.js';

const router = express.Router();

// Middleware to parse raw binary if sent as audio/ or octet-stream
const rawParser = express.raw({
  type: ['audio/*', 'application/octet-stream', 'video/webm', 'video/mp4'],
  limit: '25mb'
});

// Upload audio note
router.post('/upload', rawParser, async (req, res) => {
  try {
    let buffer = null;
    let contentType = 'audio/webm';
    let dur = 0;
    let filename = 'audio-note.webm';

    // Check if JSON body with base64 was sent
    if (req.body && typeof req.body === 'object' && req.body.data) {
      const base64Data = req.body.data.replace(/^data:audio\/[a-z0-9.-]+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      if (req.body.type) contentType = req.body.type;
      if (req.body.dur) dur = parseFloat(req.body.dur) || 0;
      if (req.body.name) filename = req.body.name;
    } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      // Raw binary body
      buffer = req.body;
      const headerType = req.headers['content-type'];
      if (headerType && !headerType.includes('multipart/')) {
        contentType = headerType.split(';')[0];
      }
      if (req.query.dur) dur = parseFloat(req.query.dur) || 0;
      if (req.query.type) contentType = req.query.type;
      if (req.query.name) filename = req.query.name;
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ message: 'No audio data received.' });
    }

    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({ message: 'Audio file too large. Max size is 25MB.' });
    }

    const id = 'aud_' + crypto.randomBytes(10).toString('hex');
    const audioDoc = await AudioFile.create({
      id,
      userId: req.user?._id || null,
      data: buffer,
      contentType,
      filename,
      size: buffer.length,
      dur: Math.round(dur || 0)
    });

    res.json({
      success: true,
      id: audioDoc.id,
      src: `/api/audio/${audioDoc.id}`,
      dur: audioDoc.dur,
      type: audioDoc.contentType,
      size: audioDoc.size
    });
  } catch (err) {
    console.error('Audio upload error:', err);
    res.status(500).json({ message: 'Failed to save audio file.' });
  }
});

// Stream / Download audio note by ID with range support
router.get('/:id', async (req, res) => {
  try {
    const audio = await AudioFile.findOne({ id: req.params.id });
    if (!audio || !audio.data) {
      return res.status(404).send('Audio note not found');
    }

    const buffer = audio.data;
    const totalSize = buffer.length;
    const contentType = audio.contentType || 'audio/webm';
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (range) {
      // Parse Range header e.g. "bytes=0-1024"
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || start >= totalSize || end >= totalSize || start > end) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).send('Requested Range Not Satisfiable');
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      return res.end(buffer.subarray(start, end + 1));
    }

    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': contentType
    });
    res.end(buffer);
  } catch (err) {
    console.error('Audio stream error:', err);
    res.status(500).send('Error streaming audio');
  }
});

// Delete audio note
router.delete('/:id', async (req, res) => {
  try {
    await AudioFile.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error('Audio delete error:', err);
    res.status(500).json({ message: 'Error deleting audio file.' });
  }
});

export default router;

