import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getYears,
  getYear,
  patchEntry,
  uploadPhoto,
  getPhoto,
  deletePhoto
} from '../controllers/journalController.js';

const router = express.Router();

const rawParser = express.raw({
  type: ['image/*', 'application/octet-stream'],
  limit: '15mb'
});

// Photo access is public / authenticated
router.get('/photo/:id', getPhoto);

// Protected routes
router.use(authMiddleware);

router.get('/years', getYears);
router.get('/:year', getYear);
router.put('/:year/:dateKey', patchEntry);
router.post('/photo', rawParser, uploadPhoto);
router.delete('/photo/:id', deletePhoto);

export default router;
