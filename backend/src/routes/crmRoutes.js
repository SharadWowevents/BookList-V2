import express from 'express';
import { protect, crmOnly } from '../middleware/auth.js';
import {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getMemberSessions,
  addMemberSession,
  updateMemberSession,
  deleteMemberSession
} from '../controllers/crmController.js';

const router = express.Router();

// All CRM routes require authentication and CRM access
router.use(protect, crmOnly);

router.get('/members', getMembers);
router.post('/members', createMember);
router.get('/members/:id', getMemberById);
router.put('/members/:id', updateMember);
router.delete('/members/:id', deleteMember);

router.get('/members/:id/sessions', getMemberSessions);
router.post('/members/:id/sessions', addMemberSession);
router.put('/members/:id/sessions/:sessionId', updateMemberSession);
router.delete('/members/:id/sessions/:sessionId', deleteMemberSession);

export default router;

