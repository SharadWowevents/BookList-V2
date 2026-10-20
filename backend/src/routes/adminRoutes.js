import express from 'express';
import {
  getConfig, updateConfig, getUsers, createUser,
  toggleUserStatus, resetPassword, deleteUser
} from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get('/config', getConfig);
router.put('/config', updateConfig);

router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:username/status', toggleUserStatus);
router.put('/users/:username/reset-password', resetPassword);
router.delete('/users/:username', deleteUser);

export default router;

