import { Note } from '../models/Note.js';
import { Share } from '../models/Share.js';
import { syncShareAcrossAllUsers } from '../utils/shareSync.js';
import { recordLog } from '../services/auditLogService.js';

export const getNote = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const note = await Note.findOne({ userId, id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    let title = note.title;
    let html = note.html || '';

    // If shared, return freshest content from Share
    if (note.shared?.sid) {
      const share = await Share.findOne({ sid: note.shared.sid });
      if (share && share.content) {
        if (share.content.title !== undefined) title = share.content.title;
        if (share.content.html !== undefined) html = share.content.html;
      }
    }

    res.json({
      id: note.id,
      title,
      html,
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

    await recordLog({
      action: 'create_note',
      category: 'notes',
      actor: req.user,
      details: `Created note '${note.title || 'Untitled note'}'`,
      targetId: note.id,
      targetType: 'note',
      newState: note.toObject(),
      canUndo: true
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
    const previousState = note ? note.toObject() : null;

    if (!note) {
      // If note body is saved before creation, upsert it
      note = new Note({ userId, id, title: title || '', html: html || '', starred: !!starred });
    } else {
      if (title !== undefined) note.title = title.trim();
      if (html !== undefined) note.html = html;
      if (starred !== undefined) note.starred = starred;
    }

    await note.save();

    await recordLog({
      action: previousState ? 'update_note' : 'create_note',
      category: 'notes',
      actor: req.user,
      details: previousState
        ? `Updated note '${note.title || 'Untitled note'}'`
        : `Created note '${note.title || 'Untitled note'}'`,
      targetId: note.id,
      targetType: 'note',
      previousState,
      newState: note.toObject(),
      canUndo: true
    });

    // Check if this note is shared and sync across all collaborators
    let shareSid = note.shared?.sid;
    if (!shareSid) {
      const share = await Share.findOne({ ownerId: userId, itemId: id });
      if (share) shareSid = share.sid;
    }

    if (shareSid) {
      syncShareAcrossAllUsers({
        sid: shareSid,
        kind: 'note',
        content: {
          title: note.title,
          ...(html !== undefined && { html: note.html })
        },
        updatedBy: req.user?.name || 'Someone'
      }).catch(() => {});
    }

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

    const note = await Note.findOne({ userId, id });
    if (!note) return res.status(404).json({ message: 'Note not found.' });

    const previousState = note.toObject();
    await Note.deleteOne({ userId, id });

    await recordLog({
      action: 'delete_note',
      category: 'notes',
      actor: req.user,
      details: `Deleted note '${note.title || 'Untitled note'}'`,
      targetId: note.id,
      targetType: 'note',
      previousState,
      canUndo: true
    });

    res.json({ message: 'Note deleted successfully.' });
  } catch (err) {
    console.error('deleteNote error:', err);
    res.status(500).json({ message: 'Error deleting note.' });
  }
};
