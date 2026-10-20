import express from 'express';
import { createShare, getShare, updateShare, deleteShare } from '../controllers/shareController.js';
import { protect, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Publicly viewable / editable by link, with optional auth context
router.get('/:sid', optionalAuth, getShare);
router.put('/:sid', optionalAuth, updateShare);

// Creating or deleting shares requires authentication
router.post('/', protect, createShare);
router.delete('/:sid', protect, deleteShare);

export default router;


