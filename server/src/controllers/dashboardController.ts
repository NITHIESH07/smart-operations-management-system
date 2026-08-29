import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { Project, IProject } from '../models/Project.ts';
import { Task, ITask } from '../models/Task.ts';
import { User, IUser } from '../models/User.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

/**
 * Helper to resolve acting user's Mongoose ObjectId
 */
const getActingUserObjectId = async (req: AuthenticatedRequest): Promise<Types.ObjectId | null> => {
  if (!req.user) return null;
  if (req.user._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
    return new Types.ObjectId(req.user._id);
  }
  const user = await User.findOne({ userId: req.user.userId });
  return user ? (user._id as Types.ObjectId) : null;
};

/**
 * GET /api/dashboard
 * Retrieve comprehensive, real-time dashboard analytics scoped by user role.
 *
 * Metrics provided:
 * - Projects: total, active, completed, planned, cancelled
 * - Tasks: total, pending, completed, overdue, byStatus, byPriority
 * - Employee Workload: breakdown of assigned, pending, completed, overdue tasks per employee
 * - Project Progress: completed / total tasks percentage for each accessible project
 */
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const actingUserObjId = await getActingUserObjectId(req);
    const userRole = req.user.role;
    const now = new Date();

    // 1. Determine Project Scoping based on Role
    let projectFilter: Record<string, unknown> = {};
    let taskFilter: Record<string, unknown> = {};

    if (userRole === 'employee') {
      if (!actingUserObjId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User context missing' });
        return;
      }

      // Employees only access projects where they are team members
      projectFilter = { teamMembers: actingUserObjId };

      const memberProjects = await Project.find(projectFilter, { _id: 1 });
      const memberProjectIds = memberProjects.map((p) => p._id);

      // Tasks scoped to member projects
      taskFilter = { projectId: { $in: memberProjectIds } };
    }

    // 2. Fetch Projects Summary
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      plannedProjects,
      cancelledProjects,
    ] = await Promise.all([
      Project.countDocuments(projectFilter),
      Project.countDocuments({ ...projectFilter, status: 'active' }),
      Project.countDocuments({ ...projectFilter, status: 'completed' }),
      Project.countDocuments({ ...projectFilter, status: 'planned' }),
      Project.countDocuments({ ...projectFilter, status: 'cancelled' }),
    ]);

    // 3. Fetch Tasks Summary (Pending = status != completed, Overdue = dueDate < now && status != completed)
    const [
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      todoTasks,
      inProgressTasks,
      reviewTasks,
      blockedTasks,
      lowPriorityTasks,
      mediumPriorityTasks,
      highPriorityTasks,
      criticalPriorityTasks,
    ] = await Promise.all([
      Task.countDocuments(taskFilter),
      Task.countDocuments({ ...taskFilter, status: 'completed' }),
      Task.countDocuments({ ...taskFilter, status: { $ne: 'completed' } }),
      Task.countDocuments({
        ...taskFilter,
        status: { $ne: 'completed' },
        dueDate: { $lt: now },
      }),
      Task.countDocuments({ ...taskFilter, status: 'todo' }),
      Task.countDocuments({ ...taskFilter, status: 'in_progress' }),
      Task.countDocuments({ ...taskFilter, status: 'review' }),
      Task.countDocuments({ ...taskFilter, status: 'blocked' }),
      Task.countDocuments({ ...taskFilter, priority: 'low' }),
      Task.countDocuments({ ...taskFilter, priority: 'medium' }),
      Task.countDocuments({ ...taskFilter, priority: 'high' }),
      Task.countDocuments({ ...taskFilter, priority: 'critical' }),
    ]);

    // 4. Project Progress Computation
    // Retrieve projects with team member info
    const projectsList = await Project.find(projectFilter)
      .populate('teamMembers', '_id userId name email role')
      .sort({ updatedAt: -1 });

    // Aggregate task counts per project
    const projectIds = projectsList.map((p) => p._id);
    const taskStatsByProject = await Task.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: '$projectId',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $ne: ['$status', 'completed'] }, 1, 0] },
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'completed'] },
                    { $ne: ['$dueDate', null] },
                    { $lt: ['$dueDate', now] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const projectTaskMap = new Map<string, { total: number; completed: number; pending: number; overdue: number }>();
    taskStatsByProject.forEach((item) => {
      projectTaskMap.set(item._id.toString(), {
        total: item.total || 0,
        completed: item.completed || 0,
        pending: item.pending || 0,
        overdue: item.overdue || 0,
      });
    });

    const projectProgressList = projectsList.map((proj) => {
      const stats = projectTaskMap.get(proj._id.toString()) || { total: 0, completed: 0, pending: 0, overdue: 0 };
      const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      return {
        _id: proj._id,
        projectId: proj.projectId,
        name: proj.name,
        description: proj.description,
        status: proj.status,
        startDate: proj.startDate,
        deadline: proj.deadline,
        teamMembers: proj.teamMembers,
        teamMembersCount: Array.isArray(proj.teamMembers) ? proj.teamMembers.length : 0,
        totalTasks: stats.total,
        completedTasks: stats.completed,
        pendingTasks: stats.pending,
        overdueTasks: stats.overdue,
        progress,
      };
    });

    // 5. Employee Workload Computation
    // Scoped by role: Admin/Manager sees all employees, Employee sees themselves and teammates in their projects
    let targetUsersQuery: Record<string, unknown> = {};
    if (userRole === 'employee') {
      if (actingUserObjId) {
        // Collect team member IDs from their accessible projects
        const teammateIds = new Set<string>();
        teammateIds.add(actingUserObjId.toString());
        projectsList.forEach((p) => {
          if (Array.isArray(p.teamMembers)) {
            p.teamMembers.forEach((m: any) => {
              if (m && m._id) teammateIds.add(m._id.toString());
            });
          }
        });
        targetUsersQuery = { _id: { $in: Array.from(teammateIds).map((id) => new Types.ObjectId(id)) } };
      }
    }

    const employees = await User.find(targetUsersQuery, {
      _id: 1,
      userId: 1,
      name: 1,
      email: 1,
      role: 1,
    }).sort({ name: 1 });

    const employeeIds = employees.map((e) => e._id);

    // Aggregate task workload per assigned user
    const workloadAggregation = await Task.aggregate([
      {
        $match: {
          ...taskFilter,
          assignedTo: { $in: employeeIds },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          totalAssigned: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          pendingTasks: {
            $sum: { $cond: [{ $ne: ['$status', 'completed'] }, 1, 0] },
          },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'completed'] },
                    { $ne: ['$dueDate', null] },
                    { $lt: ['$dueDate', now] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const workloadMap = new Map<string, { total: number; completed: number; pending: number; overdue: number }>();
    workloadAggregation.forEach((w) => {
      if (w._id) {
        workloadMap.set(w._id.toString(), {
          total: w.totalAssigned || 0,
          completed: w.completedTasks || 0,
          pending: w.pendingTasks || 0,
          overdue: w.overdueTasks || 0,
        });
      }
    });

    const employeeWorkload = employees.map((emp) => {
      const stats = workloadMap.get(emp._id.toString()) || { total: 0, completed: 0, pending: 0, overdue: 0 };
      return {
        user: {
          _id: emp._id,
          userId: emp.userId,
          name: emp.name,
          email: emp.email,
          role: emp.role,
        },
        totalAssigned: stats.total,
        completedTasks: stats.completed,
        pendingTasks: stats.pending,
        overdueTasks: stats.overdue,
      };
    });

    // 6. Overdue Tasks Detail List (Top 5 for immediate action)
    const overdueTasksList = await Task.find({
      ...taskFilter,
      status: { $ne: 'completed' },
      dueDate: { $lt: now },
    })
      .populate('assignedTo', '_id userId name email role')
      .populate('projectId', '_id projectId name status')
      .sort({ dueDate: 1 })
      .limit(5);

    // Send unified dashboard response
    res.status(200).json({
      metrics: {
        projects: {
          total: totalProjects,
          active: activeProjects,
          completed: completedProjects,
          planned: plannedProjects,
          cancelled: cancelledProjects,
        },
        tasks: {
          total: totalTasks,
          pending: pendingTasks,
          completed: completedTasks,
          overdue: overdueTasks,
          byStatus: {
            todo: todoTasks,
            in_progress: inProgressTasks,
            review: reviewTasks,
            completed: completedTasks,
            blocked: blockedTasks,
          },
          byPriority: {
            low: lowPriorityTasks,
            medium: mediumPriorityTasks,
            high: highPriorityTasks,
            critical: criticalPriorityTasks,
          },
        },
      },
      employeeWorkload,
      projectProgress: projectProgressList,
      overdueTasksList,
      role: userRole,
      generatedAt: now.toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve dashboard data';
    console.error('getDashboardStats Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve dashboard analytics',
    });
  }
};
