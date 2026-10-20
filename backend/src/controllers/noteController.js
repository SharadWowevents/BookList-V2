import { Note } from '../models/Note.js';

export const getNote = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const note = await Note.findOne({ userId, id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    res.json({
      id: note.id,
      title: note.title,
      html: note.html || '',
      starred: note.starred,
      updatedAt: note.updatedAt
    });
  } catch (err) {
    console.error('getNote error:', err);
    res.status(500).json({ message: 'Error retrieving note.' });
  }
};

export const createNote = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id, title = '', html = '', starred = false } = req.body;

    const count = await Note.countDocuments({ userId });
    const note = await Note.create({
      userId,
      id,
      title: title.trim(),
      html,
      starred,
      order: count
    });

    res.status(201).json({
      id: note.id,
      title: note.title,
      html: note.html,
      starred: note.starred,
      updatedAt: note.updatedAt
    });
  } catch (err) {
    console.error('createNote error:', err);
    res.status(500).json({ message: 'Error creating note.' });
  }
};

export const updateNote = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { title, html, starred } = req.body;

    let note = await Note.findOne({ userId, id });
    if (!note) {
      // If note body is saved before creation, upsert it
      note = new Note({ userId, id, title: title || '', html: html || '', starred: !!starred });
    } else {
      if (title !== undefined) note.title = title.trim();
      if (html !== undefined) note.html = html;
      if (starred !== undefined) note.starred = starred;
    }

    await note.save();

    res.json({
      id: note.id,
      title: note.title,
      html: note.html,
      starred: note.starred,
      updatedAt: note.updatedAt
    });
  } catch (err) {
    console.error('updateNote error:', err);
    res.status(500).json({ message: 'Error updating note.' });
  }
};

export const deleteNote = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const result = await Note.findOneAndDelete({ userId, id });
    if (!result) return res.status(404).json({ message: 'Note not found.' });

    res.json({ message: 'Note deleted successfully.' });
  } catch (err) {
    console.error('deleteNote error:', err);
    res.status(500).json({ message: 'Error deleting note.' });
  }
};

