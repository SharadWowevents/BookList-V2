import express from 'express';
import {
  getConfig, updateConfig, getUsers, createUser,
  toggleUserStatus, resetPassword, deleteUser, renameUser,
  toggleUserCrm,
  getBackupsController, createManualBackupController,
  restoreBackupController, deleteBackupController, downloadBackupController,
  getBackupConfigController, updateBackupConfigController,
  getLogsController, undoLogController
} from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(adminOnly);

// System Config
router.get('/config', getConfig);
router.put('/config', updateConfig);

// Team Users
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:username/rename', renameUser);
router.put('/users/:username/status', toggleUserStatus);
router.put('/users/:username/crm', toggleUserCrm);
router.patch('/users/:username/crm', toggleUserCrm);
router.put('/users/:username/reset-password', resetPassword);
router.delete('/users/:username', deleteUser);

// Backups (Max 5 capacity)
router.get('/backups', getBackupsController);
router.post('/backups', createManualBackupController);
router.get('/backups/:id/download', downloadBackupController);
router.post('/backups/:id/restore', restoreBackupController);
router.delete('/backups/:id', deleteBackupController);

// Backup Configuration (Frequency & Auto-backup)
router.get('/backup-config', getBackupConfigController);
router.put('/backup-config', updateBackupConfigController);

// Activity Logs (Max 200 capacity & Undo)
router.get('/logs', getLogsController);
router.post('/logs/:id/undo', undoLogController);

export default router;
