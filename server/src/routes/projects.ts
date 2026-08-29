import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  updateProjectTeam,
  deleteProject,
  getProjectActivities,
} from '../controllers/projectController.ts';
import { authenticateToken, requireRole } from '../middleware/auth.ts';

const router = Router();

// List all authorized projects (Employee filtered automatically, Manager/Admin see all)
router.get('/', authenticateToken, getProjects);

// Create Project (Manager & Admin only)
router.post('/', authenticateToken, requireRole('admin', 'manager'), createProject);

// Get Single Project by ID (Employees restricted to assigned projects)
router.get('/:projectId', authenticateToken, getProjectById);

// Update Project (Manager & Admin only)
router.put('/:projectId', authenticateToken, requireRole('admin', 'manager'), updateProject);

// Update Project Team (Manager & Admin only)
router.put('/:projectId/team', authenticateToken, requireRole('admin', 'manager'), updateProjectTeam);

// Delete Project (Manager & Admin only)
router.delete('/:projectId', authenticateToken, requireRole('admin', 'manager'), deleteProject);

// Get Project Activities / Audit history
router.get('/:projectId/activities', authenticateToken, getProjectActivities);

export default router;
