import { Share } from '../models/Share.js';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';

// Connected SSE clients for live updates across all users
const sseClients = new Set();

export const addSseClient = (res) => {
  sseClients.add(res);
  res.on('close', () => {
    sseClients.delete(res);
  });
};

export const broadcastShareEvent = (event) => {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
};

/**
 * Propagate shared changes to all users who have this share in their board,
 * update the Share document, update the owner's original list/note,
 * update all collaborator copies in MongoDB, and broadcast to open browser sessions.
 */
export const syncShareAcrossAllUsers = async ({
  sid,
  itemId,
  ownerId,
  kind,
  content,
  mode,
  updatedBy,
  skipBroadcast = false
}) => {
  try {
    let share = null;
    if (sid) {
      share = await Share.findOne({ sid });
    } else if (itemId && ownerId) {
      share = await Share.findOne({ ownerId, itemId });
    }

    if (!share) return null;

    if (mode) {
      share.mode = mode;
    }

    if (content) {
      share.content = {
        ...(share.content || {}),
        ...content
      };
      if (updatedBy) {
        share.updatedBy = updatedBy;
      }
    }

    await share.save();

    // 1. Sync for Lists
    if (share.kind === 'list') {
      const listUpdate = {};
      if (share.content?.name !== undefined) listUpdate.name = share.content.name;
      if (share.content?.todos !== undefined) listUpdate.todos = share.content.todos;

      if (Object.keys(listUpdate).length > 0) {
        // Update owner's original list
        await List.findOneAndUpdate(
          { userId: share.ownerId, id: share.itemId },
          { $set: listUpdate }
        );

        // Update all collaborator lists in DB
        await List.updateMany(
          { 'shared.sid': share.sid },
          { $set: listUpdate }
        );
      }
    }

    // 2. Sync for Notes
    if (share.kind === 'note') {
      const noteUpdate = {};
      if (share.content?.title !== undefined) noteUpdate.title = share.content.title;
      if (share.content?.html !== undefined) noteUpdate.html = share.content.html;

      if (Object.keys(noteUpdate).length > 0) {
        // Update owner's original note
        await Note.findOneAndUpdate(
          { userId: share.ownerId, id: share.itemId },
          { $set: noteUpdate }
        );

        // Update all collaborator notes in DB
        await Note.updateMany(
          { 'shared.sid': share.sid },
          { $set: noteUpdate }
        );
      }
    }

    const event = {
      type: 'share_updated',
      sid: share.sid,
      itemId: share.itemId,
      kind: share.kind,
      mode: share.mode,
      ownerName: share.ownerName,
      content: share.content,
      updatedBy: share.updatedBy,
      updatedAt: share.updatedAt
    };

    if (!skipBroadcast) {
      broadcastShareEvent(event);
    }

    return share;
  } catch (err) {
    console.error('Error in syncShareAcrossAllUsers:', err);
    return null;
  }
};

export const broadcastShareRevoked = (sid) => {
  broadcastShareEvent({
    type: 'share_revoked',
    sid
  });
};

