import { Router, Response } from 'express';
import { register, login, getMe } from '../controllers/authController.ts';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// Public Authentication Routes
router.post('/register', register);
router.post('/login', login);

// Protected Authentication Profile Route
router.get('/me', authenticateToken, getMe);

// Protected Role-Check Verification Endpoints (for authorization enforcement testing)
router.get(
  '/admin-check',
  authenticateToken,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      status: 'authorized',
      message: 'Access granted to admin-only resource',
      user: req.user,
    });
  }
);

router.get(
  '/manager-check',
  authenticateToken,
  requireRole('manager', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      status: 'authorized',
      message: 'Access granted to manager/admin resource',
      user: req.user,
    });
  }
);

router.get(
  '/employee-check',
  authenticateToken,
  requireRole('employee', 'manager', 'admin'),
  (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      status: 'authorized',
      message: 'Access granted to authenticated staff resource',
      user: req.user,
    });
  }
);

export default router;
