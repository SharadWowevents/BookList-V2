import express from 'express';
import {
  pinLogin,
  teamLogin,
  getMe,
  updateProfile,
  acceptPrivacyPolicy,
  requestPasswordResetOtp,
  verifyPasswordResetOtp
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/pin-login', pinLogin);
router.post('/team-login', teamLogin);
router.post('/forgot-password/request-otp', requestPasswordResetOtp);
router.post('/forgot-password/verify-otp', verifyPasswordResetOtp);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/accept-privacy', protect, acceptPrivacyPolicy);

export default router;

