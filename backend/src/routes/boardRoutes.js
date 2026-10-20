import express from 'express';
import { getBoard, syncBoard, createList, updateList, deleteList } from '../controllers/boardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getBoard);
router.put('/', syncBoard);
router.post('/lists', createList);
router.put('/lists/:id', updateList);
router.delete('/lists/:id', deleteList);

export default router;

