import express from 'express';
import { createShare, getShare, updateShare, deleteShare } from '../controllers/shareController.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { addSseClient } from '../utils/shareSync.js';

const router = express.Router();

// SSE live stream for real-time collaboration updates across shared items
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(':connected\n\n');
  addSseClient(res);

  // Send periodic ping to prevent connection timeout
  const pinger = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch {
      clearInterval(pinger);
    }
  }, 25000);

  res.on('close', () => {
    clearInterval(pinger);
  });
});

// Publicly viewable / editable by link, with optional auth context
router.get('/:sid', optionalAuth, getShare);
router.put('/:sid', optionalAuth, updateShare);

// Creating or deleting shares with optional auth context
router.post('/', optionalAuth, createShare);
router.delete('/:sid', optionalAuth, deleteShare);

export default router;


