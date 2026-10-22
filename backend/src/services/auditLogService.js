import { AuditLog, pruneAuditLogs } from '../models/AuditLog.js';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { CrmMember } from '../models/CrmMember.js';
import { User } from '../models/User.js';
import { Backup } from '../models/Backup.js';

export const recordLog = async ({
  action,
  category = 'lists',
  actor = null,
  details,
  targetId = '',
  targetType = '',
  previousState = null,
  newState = null,
  canUndo = true
}) => {
  try {
    const id = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const actorId = actor?._id || null;
    const actorUsername = actor?.username || 'system';
    const actorName = actor?.name || actorUsername;

    const log = await AuditLog.create({
      id,
      action,
      category,
      actorId,
      actorUsername,
      actorName,
      details,
      targetId: String(targetId || ''),
      targetType: String(targetType || ''),
      previousState,
      newState,
      canUndo: !!canUndo,
      isUndone: false
    });

    // Strictly enforce max 200 logs capacity
    await pruneAuditLogs(200);

    return log;
  } catch (err) {
    console.error('recordLog error:', err);
    return null;
  }
};

export const getLogs = async ({ limit = 200, category = null, search = '' } = {}) => {
  try {
    const filter = {};
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (search && search.trim()) {
      const reg = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { details: reg },
        { actorUsername: reg },
        { actorName: reg },
        { action: reg },
        { targetId: reg }
      ];
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 200));

    return logs;
  } catch (err) {
    console.error('getLogs error:', err);
    throw err;
  }
};

export const undoLogEntry = async (logId, adminUser) => {
  try {
    const log = await AuditLog.findOne({ id: logId });
    if (!log) {
      const err = new Error('Log entry not found.');
      err.status = 404;
      throw err;
    }

    if (!log.canUndo || log.isUndone) {
      const err = new Error('This action cannot be undone or has already been undone.');
      err.status = 400;
      throw err;
    }

    const { action, targetId, targetType, previousState, newState } = log;

    // Execute reverse operation
    switch (action) {
      case 'create_list': {
        // Reverse: delete the created list
        if (targetId) {
          await List.deleteOne({ id: targetId });
        }
        break;
      }

      case 'delete_list': {
        // Reverse: restore the deleted list from previousState
        if (previousState) {
          const listDoc = { ...previousState };
          delete listDoc._id; // Ensure clean insert
          await List.create(listDoc);
        }
        break;
      }

      case 'update_list': {
        // Reverse: restore the list to previousState
        if (previousState && targetId) {
          const listDoc = { ...previousState };
          delete listDoc._id;
          await List.findOneAndUpdate({ id: targetId }, listDoc, { upsert: true });
        }
        break;
      }

      case 'create_note': {
        // Reverse: delete the created note
        if (targetId) {
          await Note.deleteOne({ id: targetId });
        }
        break;
      }

      case 'delete_note': {
        // Reverse: recreate the note from previousState
        if (previousState) {
          const noteDoc = { ...previousState };
          delete noteDoc._id;
          await Note.create(noteDoc);
        }
        break;
      }

      case 'update_note': {
        // Reverse: restore note to previousState
        if (previousState && targetId) {
          const noteDoc = { ...previousState };
          delete noteDoc._id;
          await Note.findOneAndUpdate({ id: targetId }, noteDoc, { upsert: true });
        }
        break;
      }

      case 'create_member': {
        // Reverse: delete the CRM member
        if (targetId) {
          await CrmMember.deleteOne({ id: targetId });
        }
        break;
      }

      case 'delete_member': {
        // Reverse: recreate the CRM member from previousState
        if (previousState) {
          const memberDoc = { ...previousState };
          delete memberDoc._id;
          await CrmMember.create(memberDoc);
        }
        break;
      }

      case 'update_member': {
        // Reverse: restore CRM member to previousState
        if (previousState && targetId) {
          const memberDoc = { ...previousState };
          delete memberDoc._id;
          await CrmMember.findOneAndUpdate({ id: targetId }, memberDoc, { upsert: true });
        }
        break;
      }

      case 'add_session': {
        // Reverse: remove session note from member
        const sessionId = newState?.sessionId || newState?.id;
        if (targetId && sessionId) {
          await CrmMember.findOneAndUpdate(
            { id: targetId },
            { $pull: { sessions: { id: sessionId } } }
          );
        }
        break;
      }

      case 'delete_session': {
        // Reverse: restore deleted session note
        if (targetId && previousState?.session) {
          await CrmMember.findOneAndUpdate(
            { id: targetId },
            { $push: { sessions: previousState.session } }
          );
        }
        break;
      }

      case 'create_user': {
        // Reverse: delete created user and their default lists
        if (targetId) {
          const user = await User.findOne({ username: targetId });
          if (user) {
            await List.deleteMany({ userId: user._id });
            await Note.deleteMany({ userId: user._id });
            await User.deleteOne({ _id: user._id });
          }
        }
        break;
      }

      case 'delete_user': {
        // Reverse: recreate user and their lists/notes from previousState
        if (previousState?.user) {
          const userDoc = { ...previousState.user };
          delete userDoc._id;
          const restoredUser = await User.create(userDoc);
          if (Array.isArray(previousState.lists) && previousState.lists.length > 0) {
            const listsToInsert = previousState.lists.map(l => ({ ...l, userId: restoredUser._id }));
            await List.insertMany(listsToInsert);
          }
          if (Array.isArray(previousState.notes) && previousState.notes.length > 0) {
            const notesToInsert = previousState.notes.map(n => ({ ...n, userId: restoredUser._id }));
            await Note.insertMany(notesToInsert);
          }
        }
        break;
      }

      case 'create_backup': {
        // Reverse: delete backup
        if (targetId) {
          await Backup.deleteOne({ id: targetId });
        }
        break;
      }

      case 'restore_backup': {
        // Reverse: restore prior state before restore occurred
        if (previousState) {
          if (Array.isArray(previousState.lists)) {
            await List.deleteMany({});
            if (previousState.lists.length > 0) await List.insertMany(previousState.lists);
          }
          if (Array.isArray(previousState.notes)) {
            await Note.deleteMany({});
            if (previousState.notes.length > 0) await Note.insertMany(previousState.notes);
          }
          if (Array.isArray(previousState.crmMembers)) {
            await CrmMember.deleteMany({});
            if (previousState.crmMembers.length > 0) await CrmMember.insertMany(previousState.crmMembers);
          }
        }
        break;
      }

      default: {
        // Generic previousState rollback if target exists
        if (previousState && targetId && targetType) {
          if (targetType === 'list') {
            await List.findOneAndUpdate({ id: targetId }, previousState, { upsert: true });
          } else if (targetType === 'note') {
            await Note.findOneAndUpdate({ id: targetId }, previousState, { upsert: true });
          } else if (targetType === 'crm_member') {
            await CrmMember.findOneAndUpdate({ id: targetId }, previousState, { upsert: true });
          }
        }
        break;
      }
    }

    // Mark current log as undone
    log.isUndone = true;
    log.undoneAt = new Date();
    log.undoneBy = adminUser?.username || 'admin';
    await log.save();

    // Log the undo action itself
    await recordLog({
      action: 'undo_action',
      category: 'admin',
      actor: adminUser,
      details: `Undid action: ${log.details}`,
      targetId: log.id,
      targetType: 'log',
      canUndo: false
    });

    return log;
  } catch (err) {
    console.error('undoLogEntry error:', err);
    throw err;
  }
};

