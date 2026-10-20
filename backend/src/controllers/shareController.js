import { Share } from '../models/Share.js';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';

const uid = () => (Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)).replace(/[^a-z0-9]/g, '');

export const createShare = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId, kind, mode = 'edit' } = req.body;

    let content = {};
    if (kind === 'list') {
      const list = await List.findOne({ userId, id: itemId });
      if (!list) return res.status(404).json({ message: 'List not found.' });
      content = { name: list.name, todos: list.todos };
    } else {
      const note = await Note.findOne({ userId, id: itemId });
      if (!note) return res.status(404).json({ message: 'Note not found.' });
      content = { title: note.title, html: note.html };
    }

    let share = await Share.findOne({ ownerId: userId, itemId });
    if (share) {
      share.mode = mode;
      share.content = content;
      share.updatedBy = req.user.name || 'Someone';
      await share.save();
    } else {
      const sid = uid();
      share = await Share.create({
        sid,
        ownerId: userId,
        ownerName: req.user.name || 'Someone',
        itemId,
        kind,
        mode,
        content,
        updatedBy: req.user.name || 'Someone'
      });
    }

    res.status(200).json({
      sid: share.sid,
      itemId: share.itemId,
      kind: share.kind,
      mode: share.mode,
      ownerName: share.ownerName,
      content: share.content,
      updatedAt: share.updatedAt,
      own: true,
      canEdit: true
    });
  } catch (err) {
    console.error('createShare error:', err);
    res.status(500).json({ message: 'Error sharing item.' });
  }
};

export const getShare = async (req, res) => {
  try {
    const { sid } = req.params;
    const share = await Share.findOne({ sid });
    if (!share) {
      return res.status(404).json({ message: 'This shared item no longer exists or the link has expired.' });
    }

    const isOwn = req.user ? share.ownerId.equals(req.user._id) : false;

    res.json({
      sid: share.sid,
      itemId: share.itemId,
      ownerName: share.ownerName,
      ownerId: share.ownerId,
      kind: share.kind,
      mode: share.mode,
      content: share.content,
      updatedAt: share.updatedAt,
      updatedBy: share.updatedBy,
      own: isOwn,
      canEdit: isOwn || share.mode === 'edit'
    });
  } catch (err) {
    console.error('getShare error:', err);
    res.status(500).json({ message: 'Error retrieving shared item.' });
  }
};

export const updateShare = async (req, res) => {
  try {
    const { sid } = req.params;
    const { content, mode } = req.body;

    const share = await Share.findOne({ sid });
    if (!share) return res.status(404).json({ message: 'Shared item not found.' });

    const isOwner = req.user && share.ownerId.equals(req.user._id);

    // If caller is authenticated owner and wants to change permission mode
    if (mode && isOwner) {
      share.mode = mode;
    }

    if (content) {
      if (share.mode !== 'edit' && !isOwner) {
        return res.status(403).json({ message: 'This item is view-only. You cannot edit it.' });
      }
      share.content = content;
      share.updatedBy = req.user ? req.user.name : 'Someone';
    }

    await share.save();

    // Also sync back to owner's original list or note if owner is updating
    if (isOwner && content) {
      if (share.kind === 'list') {
        await List.findOneAndUpdate(
          { userId: req.user._id, id: share.itemId },
          { name: content.name, todos: content.todos }
        );
      } else {
        await Note.findOneAndUpdate(
          { userId: req.user._id, id: share.itemId },
          { title: content.title, html: content.html }
        );
      }
    }

    res.json({
      sid: share.sid,
      itemId: share.itemId,
      mode: share.mode,
      content: share.content,
      updatedAt: share.updatedAt,
      updatedBy: share.updatedBy,
      own: isOwner,
      canEdit: isOwner || share.mode === 'edit'
    });
  } catch (err) {
    console.error('updateShare error:', err);
    res.status(500).json({ message: 'Error updating shared item.' });
  }
};

export const deleteShare = async (req, res) => {
  try {
    const { sid } = req.params;
    const share = await Share.findOne({ sid });
    if (!share) return res.status(404).json({ message: 'Shared item not found.' });

    if (!share.ownerId.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the owner can stop sharing.' });
    }

    await Share.deleteOne({ sid });
    res.json({ message: 'Sharing stopped. The item is private again.' });
  } catch (err) {
    console.error('deleteShare error:', err);
    res.status(500).json({ message: 'Error stopping share.' });
  }
};

