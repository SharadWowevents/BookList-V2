import { Backup, pruneBackups, MAX_BACKUPS } from '../models/Backup.js';
import { Config } from '../models/Config.js';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { CrmMember } from '../models/CrmMember.js';
import { User } from '../models/User.js';
import { recordLog } from './auditLogService.js';

let autoBackupTimer = null;

export const createBackup = async ({
  type = 'manual',
  createdBy = 'admin',
  createdByName = 'Admin',
  label = ''
} = {}) => {
  try {
    const lists = await List.find({}).lean();
    const notes = await Note.find({}).lean();
    const crmMembers = await CrmMember.find({}).lean();
    const users = await User.find({}).lean();
    const config = await Config.findOne({ key: 'app' }).lean();

    const backupPayload = {
      version: 2,
      createdAt: new Date().toISOString(),
      type,
      data: {
        lists,
        notes,
        crmMembers,
        users,
        config
      }
    };

    const jsonStr = JSON.stringify(backupPayload);
    const size = Buffer.byteLength(jsonStr, 'utf8');

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const finalLabel = label.trim() || (type === 'manual'
      ? `Manual snapshot by ${createdByName || createdBy}`
      : `Auto snapshot (${dateFormatted})`);

    const id = 'bkp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

    const backup = await Backup.create({
      id,
      type,
      label: finalLabel,
      createdBy,
      createdByName,
      counts: {
        lists: lists.length,
        notes: notes.length,
        crmMembers: crmMembers.length,
        users: users.length
      },
      size,
      data: backupPayload
    });

    // Enforce max 5 backups capacity (delete oldest if > 5)
    await pruneBackups(MAX_BACKUPS);

    // Record activity log
    await recordLog({
      action: 'create_backup',
      category: 'backup',
      actor: { username: createdBy, name: createdByName },
      details: `Created ${type} backup '${finalLabel}' (${(size / 1024).toFixed(1)} KB, ${lists.length} lists, ${notes.length} notes, ${crmMembers.length} CRM members)`,
      targetId: id,
      targetType: 'backup',
      canUndo: true
    });

    return {
      id: backup.id,
      type: backup.type,
      label: backup.label,
      createdBy: backup.createdBy,
      createdByName: backup.createdByName,
      counts: backup.counts,
      size: backup.size,
      createdAt: backup.createdAt
    };
  } catch (err) {
    console.error('createBackup error:', err);
    throw err;
  }
};

export const getBackups = async () => {
  try {
    const backups = await Backup.find({})
      .select('id type label createdBy createdByName counts size createdAt')
      .sort({ createdAt: -1 })
      .limit(MAX_BACKUPS);

    return backups;
  } catch (err) {
    console.error('getBackups error:', err);
    throw err;
  }
};

export const getBackupById = async (id) => {
  try {
    const backup = await Backup.findOne({ id });
    return backup;
  } catch (err) {
    console.error('getBackupById error:', err);
    throw err;
  }
};

export const restoreBackup = async (id, adminUser) => {
  try {
    const backup = await Backup.findOne({ id });
    if (!backup) {
      const err = new Error('Backup not found.');
      err.status = 404;
      throw err;
    }

    // Save previous state for undo capability
    const preRestoreLists = await List.find({}).lean();
    const preRestoreNotes = await Note.find({}).lean();
    const preRestoreMembers = await CrmMember.find({}).lean();

    const previousState = {
      lists: preRestoreLists,
      notes: preRestoreNotes,
      crmMembers: preRestoreMembers
    };

    const payload = backup.data?.data || backup.data;
    if (!payload) {
      throw new Error('Invalid backup data structure.');
    }

    // Restore lists
    if (Array.isArray(payload.lists)) {
      await List.deleteMany({});
      if (payload.lists.length > 0) {
        const cleanLists = payload.lists.map(l => {
          const doc = { ...l };
          delete doc._id;
          return doc;
        });
        await List.insertMany(cleanLists);
      }
    }

    // Restore notes
    if (Array.isArray(payload.notes)) {
      await Note.deleteMany({});
      if (payload.notes.length > 0) {
        const cleanNotes = payload.notes.map(n => {
          const doc = { ...n };
          delete doc._id;
          return doc;
        });
        await Note.insertMany(cleanNotes);
      }
    }

    // Restore CRM members
    if (Array.isArray(payload.crmMembers)) {
      await CrmMember.deleteMany({});
      if (payload.crmMembers.length > 0) {
        const cleanMembers = payload.crmMembers.map(m => {
          const doc = { ...m };
          delete doc._id;
          return doc;
        });
        await CrmMember.insertMany(cleanMembers);
      }
    }

    // Log the restore event (can be undone to previousState!)
    await recordLog({
      action: 'restore_backup',
      category: 'backup',
      actor: adminUser,
      details: `Restored backup '${backup.label || backup.id}' (${payload.lists?.length || 0} lists, ${payload.notes?.length || 0} notes, ${payload.crmMembers?.length || 0} CRM members)`,
      targetId: backup.id,
      targetType: 'backup',
      previousState,
      canUndo: true
    });

    return {
      success: true,
      message: `Backup '${backup.label || backup.id}' restored successfully.`,
      counts: backup.counts
    };
  } catch (err) {
    console.error('restoreBackup error:', err);
    throw err;
  }
};

export const deleteBackup = async (id, adminUser) => {
  try {
    const backup = await Backup.findOne({ id });
    if (!backup) {
      const err = new Error('Backup not found.');
      err.status = 404;
      throw err;
    }

    await Backup.deleteOne({ id });

    await recordLog({
      action: 'delete_backup',
      category: 'backup',
      actor: adminUser,
      details: `Deleted backup '${backup.label || backup.id}'`,
      targetId: id,
      targetType: 'backup',
      previousState: {
        id: backup.id,
        label: backup.label,
        type: backup.type,
        counts: backup.counts,
        size: backup.size
      },
      canUndo: false
    });

    return { success: true, message: `Backup '${backup.label || id}' deleted.` };
  } catch (err) {
    console.error('deleteBackup error:', err);
    throw err;
  }
};

export const getBackupConfig = async () => {
  try {
    let config = await Config.findOne({ key: 'app' });
    if (!config) {
      config = await Config.create({ key: 'app', requireLogin: false });
    }
    const bc = config.backupConfig || {
      autoBackupEnabled: true,
      intervalHours: 24,
      lastAutoBackup: null
    };

    return {
      autoBackupEnabled: bc.autoBackupEnabled ?? true,
      intervalHours: bc.intervalHours ?? 24,
      lastAutoBackup: bc.lastAutoBackup || null
    };
  } catch (err) {
    console.error('getBackupConfig error:', err);
    throw err;
  }
};

export const updateBackupConfig = async ({ autoBackupEnabled, intervalHours }, adminUser) => {
  try {
    let config = await Config.findOne({ key: 'app' });
    if (!config) {
      config = new Config({ key: 'app' });
    }
    if (!config.backupConfig) {
      config.backupConfig = {
        autoBackupEnabled: true,
        intervalHours: 24,
        lastAutoBackup: null
      };
    }

    const previousConfig = {
      autoBackupEnabled: config.backupConfig.autoBackupEnabled,
      intervalHours: config.backupConfig.intervalHours
    };

    if (autoBackupEnabled !== undefined) {
      config.backupConfig.autoBackupEnabled = !!autoBackupEnabled;
    }

    if (intervalHours !== undefined) {
      const hours = Math.max(1, Math.min(168, Number(intervalHours) || 24));
      config.backupConfig.intervalHours = hours;
    }

    await config.save();

    await recordLog({
      action: 'update_backup_config',
      category: 'backup',
      actor: adminUser,
      details: `Updated backup schedule: ${config.backupConfig.autoBackupEnabled ? `Auto-backup every ${config.backupConfig.intervalHours}h` : 'Auto-backup disabled'}`,
      targetId: 'config',
      targetType: 'config',
      previousState: previousConfig,
      newState: {
        autoBackupEnabled: config.backupConfig.autoBackupEnabled,
        intervalHours: config.backupConfig.intervalHours
      },
      canUndo: false
    });

    return {
      autoBackupEnabled: config.backupConfig.autoBackupEnabled,
      intervalHours: config.backupConfig.intervalHours,
      lastAutoBackup: config.backupConfig.lastAutoBackup
    };
  } catch (err) {
    console.error('updateBackupConfig error:', err);
    throw err;
  }
};

export const checkAndRunAutoBackup = async () => {
  try {
    const config = await Config.findOne({ key: 'app' });
    if (!config || !config.backupConfig || !config.backupConfig.autoBackupEnabled) {
      return;
    }

    const { intervalHours = 24, lastAutoBackup } = config.backupConfig;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const now = Date.now();
    const lastTime = lastAutoBackup ? new Date(lastAutoBackup).getTime() : 0;

    if (now - lastTime >= intervalMs) {
      console.log(`[AutoBackup] Running auto-backup (interval: ${intervalHours}h)...`);
      const bkp = await createBackup({
        type: 'auto',
        createdBy: 'system',
        createdByName: 'System Scheduler',
        label: `Scheduled Auto-Backup (${intervalHours}h)`
      });

      config.backupConfig.lastAutoBackup = new Date();
      await config.save();
      console.log(`[AutoBackup] Completed backup: ${bkp.id} (${(bkp.size / 1024).toFixed(1)} KB)`);
    }
  } catch (err) {
    console.error('[AutoBackup] Error during automated backup execution:', err);
  }
};

export const startAutoBackupScheduler = () => {
  if (autoBackupTimer) clearInterval(autoBackupTimer);
  // Check every 3 minutes
  autoBackupTimer = setInterval(checkAndRunAutoBackup, 3 * 60 * 1000);
  // Check shortly after boot
  setTimeout(checkAndRunAutoBackup, 15 * 1000);
  console.log('[AutoBackup] Scheduler active (checks every 3 minutes, max capacity 5 backups).');
};
