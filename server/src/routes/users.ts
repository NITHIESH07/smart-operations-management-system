import { Router } from 'express';
import { getUsers } from '../controllers/userController.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// Protected: Get list of team users
router.get('/', authenticateToken, getUsers);

export default router;
