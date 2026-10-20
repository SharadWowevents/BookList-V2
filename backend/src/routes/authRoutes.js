import express from 'express';
import { pinLogin, teamLogin, getMe, updateProfile } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/pin-login', pinLogin);
router.post('/team-login', teamLogin);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

export default router;

