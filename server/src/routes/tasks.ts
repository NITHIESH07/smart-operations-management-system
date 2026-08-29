import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  assignTask,
  changeTaskStatus,
  addTaskComment,
  deleteTask,
  getTaskActivities,
} from '../controllers/taskController.ts';
import { authenticateToken, requireRole } from '../middleware/auth.ts';

const router = Router();

// All task routes require authentication
router.use(authenticateToken);

// 1. Task List & Querying (Filtering, Sorting, Pagination, Search)
router.get('/', getTasks);

// 2. Create Task (Manager / Admin only)
router.post('/', requireRole('admin', 'manager'), createTask);

// 3. Single Task Retrieval
router.get('/:taskId', getTaskById);

// 4. Update Task (Admins/Managers full edit; Assigned Employees limited edit)
router.put('/:taskId', updateTask);

// 5. Assign / Reassign Task (Admins / Managers only)
router.put('/:taskId/assign', requireRole('admin', 'manager'), assignTask);

// 6. Change Task Status (State machine enforced)
router.patch('/:taskId/status', changeTaskStatus);

// 7. Add Comment to Task
router.post('/:taskId/comments', addTaskComment);

// 8. Delete Task (Admins / Managers only)
router.delete('/:taskId', requireRole('admin', 'manager'), deleteTask);

// 9. Task Audit / Activity Trail
router.get('/:taskId/activities', getTaskActivities);

export default router;
