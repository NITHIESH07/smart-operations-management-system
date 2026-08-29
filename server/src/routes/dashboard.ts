import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// GET /api/dashboard - retrieve real-time role-scoped dashboard metrics
router.get('/', authenticateToken, getDashboardStats);

export default router;
