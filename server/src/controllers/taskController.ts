import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { Task, ITask, TaskPriority, TaskStatus } from '../models/Task.ts';
import { Project, IProject } from '../models/Project.ts';
import { User, IUser } from '../models/User.ts';
import { Activity } from '../models/Activity.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

const ALLOWED_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
const ALLOWED_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'completed', 'blocked'];

/**
 * Strict state machine for task status transitions:
 * todo -> in_progress
 * in_progress -> review
 * review -> completed (or in_progress for revision)
 */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress'],
  in_progress: ['review'],
  review: ['completed', 'in_progress'],
  completed: [],
  blocked: ['todo', 'in_progress'],
};

/**
 * Generate unique human-readable Task ID (e.g. TSK-172483-4921)
 */
const generateTaskId = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `TSK-${timestamp}-${random}`;
};

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
 * Helper to resolve a project by either its string projectId (e.g. PRJ-xxx) or MongoDB _id
 */
const resolveProject = async (projectIdentifier: string): Promise<IProject | null> => {
  if (!projectIdentifier) return null;
  if (mongoose.Types.ObjectId.isValid(projectIdentifier)) {
    return Project.findOne({
      $or: [{ _id: projectIdentifier }, { projectId: projectIdentifier }],
    });
  }
  return Project.findOne({ projectId: projectIdentifier });
};

/**
 * Helper to resolve a task by string taskId (e.g. TSK-xxx) or MongoDB _id
 */
const resolveTask = async (taskIdentifier: string): Promise<ITask | null> => {
  if (!taskIdentifier) return null;
  if (mongoose.Types.ObjectId.isValid(taskIdentifier)) {
    return Task.findOne({
      $or: [{ _id: taskIdentifier }, { taskId: taskIdentifier }],
    });
  }
  return Task.findOne({ taskId: taskIdentifier });
};

/**
 * Check if a date is overdue (dueDate in past and status not completed)
 */
const computeIsOverdue = (task: { dueDate?: Date | string | null; status: string }): boolean => {
  if (!task.dueDate || task.status === 'completed') return false;
  const due = new Date(task.dueDate);
  return !isNaN(due.getTime()) && due.getTime() < Date.now();
};

/**
 * CREATE TASK
 * POST /api/tasks
 * Managers & Admins only
 */
export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, projectId, priority, status, assignedTo, dueDate } = req.body;

    // 1. Validate Title
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Task title is required and must be at least 2 characters',
      });
      return;
    }

    // 2. Validate & Resolve Project
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'A task must belong to an existing project (projectId is required)',
      });
      return;
    }

    const project = await resolveProject(projectId);
    if (!project) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Specified project does not exist: ${projectId}`,
      });
      return;
    }

    // 3. Validate Priority
    let taskPriority: TaskPriority = 'medium';
    if (priority) {
      const normalizedPriority = String(priority).toLowerCase() as TaskPriority;
      if (!ALLOWED_PRIORITIES.includes(normalizedPriority)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Invalid priority: ${priority}. Allowed: ${ALLOWED_PRIORITIES.join(', ')}`,
        });
        return;
      }
      taskPriority = normalizedPriority;
    }

    // 4. Validate Status (New tasks start at todo unless specified, must be valid)
    let taskStatus: TaskStatus = 'todo';
    if (status) {
      const normalizedStatus = String(status).toLowerCase() as TaskStatus;
      if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Invalid task status: ${status}. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
        return;
      }
      taskStatus = normalizedStatus;
    }

    // 5. Validate & Resolve Assignee (Must be an active member of the project)
    let assignedUserObjId: Types.ObjectId | undefined;
    if (assignedTo) {
      let targetUser: IUser | null = null;
      if (mongoose.Types.ObjectId.isValid(assignedTo)) {
        targetUser = await User.findOne({
          $or: [{ _id: assignedTo }, { userId: assignedTo }],
        });
      } else {
        targetUser = await User.findOne({ userId: assignedTo });
      }

      if (!targetUser) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Assigned user not found in database: ${assignedTo}`,
        });
        return;
      }

      // Check if this user is an active team member of the project
      const isMember = project.teamMembers.some((m) => m.toString() === targetUser!._id.toString());
      if (!isMember) {
        res.status(400).json({
          error: 'Validation Error',
          message: `User ${targetUser.name} (${targetUser.userId}) is not an active team member of project "${project.name}"`,
        });
        return;
      }

      assignedUserObjId = targetUser._id as Types.ObjectId;
    }

    // 6. Validate Due Date
    let parsedDueDate: Date | undefined;
    if (dueDate) {
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid dueDate format',
        });
        return;
      }
    }

    // 7. Generate Task ID & Create Document
    let taskId = generateTaskId();
    let collisionCheck = await Task.findOne({ taskId });
    while (collisionCheck) {
      taskId = generateTaskId();
      collisionCheck = await Task.findOne({ taskId });
    }

    const task = new Task({
      taskId,
      title: title.trim(),
      description: description ? String(description).trim() : '',
      priority: taskPriority,
      status: taskStatus,
      projectId: project._id,
      assignedTo: assignedUserObjId,
      dueDate: parsedDueDate,
      comments: [],
    });

    await task.save();

    // Populate for response
    await task.populate([
      { path: 'assignedTo', select: '_id userId name email role' },
      { path: 'projectId', select: '_id projectId name status deadline teamMembers' },
    ]);

    // 8. Audit Logging
    const actingUserObjId = await getActingUserObjectId(req);
    if (actingUserObjId) {
      await Activity.create({
        userId: actingUserObjId,
        action: 'CREATE_TASK',
        entity: 'Task',
        previousValue: null,
        newValue: {
          taskId: task.taskId,
          title: task.title,
          projectId: project.projectId,
          priority: task.priority,
          status: task.status,
          assignedTo: assignedUserObjId ? assignedUserObjId.toString() : null,
          dueDate: task.dueDate,
        },
        timestamp: new Date(),
      });
    }

    const taskObj = task.toObject();
    res.status(201).json({
      message: 'Task created successfully',
      task: {
        ...taskObj,
        isOverdue: computeIsOverdue(taskObj),
      },
    });
  } catch (error: unknown) {
    console.error('Error creating task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create task',
    });
  }
};

/**
 * GET TASKS (List with Search, Filtering, Sorting & Pagination)
 * GET /api/tasks
 */
export const getTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      projectId,
      status,
      priority,
      assignedTo,
      search,
      overdue,
      dueDateFrom,
      dueDateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '10',
    } = req.query;

    const actingUserObjId = await getActingUserObjectId(req);
    const userRole = req.user?.role;

    const query: Record<string, unknown> = {};

    // 1. Role-based scoping for Employees
    if (userRole === 'employee') {
      if (!actingUserObjId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User context missing' });
        return;
      }
      // Employee can only see tasks from projects where they are team members
      const memberProjects = await Project.find(
        { teamMembers: actingUserObjId },
        { _id: 1 }
      );
      const memberProjectIds = memberProjects.map((p) => p._id);

      query.projectId = { $in: memberProjectIds };
    }

    // 2. Filter by Project
    if (projectId && typeof projectId === 'string') {
      const resolvedProj = await resolveProject(projectId);
      if (resolvedProj) {
        // If employee, verify they are in this project
        if (userRole === 'employee' && actingUserObjId) {
          const isMember = resolvedProj.teamMembers.some(
            (m) => m.toString() === actingUserObjId.toString()
          );
          if (!isMember) {
            res.status(403).json({
              error: 'Forbidden',
              message: 'Access denied. You are not a team member of this project.',
            });
            return;
          }
        }
        query.projectId = resolvedProj._id;
      } else {
        // Project doesn't exist, return empty page
        res.status(200).json({
          tasks: [],
          pagination: { total: 0, page: 1, limit: Number(limit) || 10, totalPages: 0, hasNext: false, hasPrev: false },
        });
        return;
      }
    }

    // 3. Filter by Status
    if (status && typeof status === 'string' && status !== 'all') {
      const normStatus = status.toLowerCase();
      if (ALLOWED_STATUSES.includes(normStatus as TaskStatus)) {
        query.status = normStatus;
      }
    }

    // 4. Filter by Priority
    if (priority && typeof priority === 'string' && priority !== 'all') {
      const normPriority = priority.toLowerCase();
      if (ALLOWED_PRIORITIES.includes(normPriority as TaskPriority)) {
        query.priority = normPriority;
      }
    }

    // 5. Filter by Assigned Employee
    if (assignedTo && typeof assignedTo === 'string' && assignedTo !== 'all') {
      if (assignedTo === 'unassigned') {
        query.assignedTo = { $exists: false };
      } else if (mongoose.Types.ObjectId.isValid(assignedTo)) {
        query.assignedTo = new Types.ObjectId(assignedTo);
      } else {
        const targetUser = await User.findOne({ userId: assignedTo });
        if (targetUser) {
          query.assignedTo = targetUser._id;
        }
      }
    }

    // 6. Search Title, Description, or Task ID (Sanitize regex input)
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitized, 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }, { taskId: searchRegex }];
    }

    // 7. Filter by Overdue or Date range
    const now = new Date();
    const dueDateCondition: Record<string, unknown> = {};

    if (overdue === 'true') {
      dueDateCondition.$lt = now;
      query.status = { $ne: 'completed' };
    } else if (overdue === 'false') {
      query.$or = [{ dueDate: { $gte: now } }, { status: 'completed' }, { dueDate: { $exists: false } }];
    }

    if (dueDateFrom && typeof dueDateFrom === 'string') {
      const from = new Date(dueDateFrom);
      if (!isNaN(from.getTime())) {
        dueDateCondition.$gte = from;
      }
    }
    if (dueDateTo && typeof dueDateTo === 'string') {
      const to = new Date(dueDateTo);
      if (!isNaN(to.getTime())) {
        dueDateCondition.$lte = to;
      }
    }

    if (Object.keys(dueDateCondition).length > 0) {
      query.dueDate = dueDateCondition;
    }

    // 8. Sorting (Whitelist allowed sort fields and validate order)
    const ALLOWED_SORT_FIELDS = ['createdAt', 'dueDate', 'priority', 'status', 'title', 'updatedAt'];
    const sortField = typeof sortBy === 'string' && ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions: Record<string, 1 | -1> = { [sortField]: sortDirection };

    // 9. Pagination (Sanitized and bounded)
    const rawPage = parseInt(page as string, 10);
    const pageNum = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

    const rawLimit = parseInt(limit as string, 10);
    const limitNum = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    const tasks = await Task.find(query)
      .populate('assignedTo', '_id userId name email role')
      .populate('projectId', '_id projectId name status deadline teamMembers')
      .populate('comments.userId', '_id userId name email role')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const enrichedTasks = tasks.map((t) => {
      const obj = t.toObject();
      return {
        ...obj,
        isOverdue: computeIsOverdue(obj),
      };
    });

    res.status(200).json({
      tasks: enrichedTasks,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch tasks',
    });
  }
};

/**
 * GET SINGLE TASK BY ID
 * GET /api/tasks/:taskId
 */
export const getTaskById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const actingUserObjId = await getActingUserObjectId(req);
    const userRole = req.user?.role;

    const task = await resolveTask(taskId);
    if (!task) {
      res.status(404).json({
        error: 'Not Found',
        message: `Task not found: ${taskId}`,
      });
      return;
    }

    await task.populate([
      { path: 'assignedTo', select: '_id userId name email role' },
      { path: 'projectId', select: '_id projectId name status deadline teamMembers' },
      { path: 'comments.userId', select: '_id userId name email role' },
    ]);

    // Role-based Access check: If employee, must belong to the project
    if (userRole === 'employee' && actingUserObjId) {
      const project = await Project.findById(task.projectId);
      if (!project) {
        res.status(404).json({ error: 'Not Found', message: 'Associated project not found' });
        return;
      }
      const isMember = project.teamMembers.some(
        (m) => m.toString() === actingUserObjId.toString()
      );
      if (!isMember) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You are not a team member of the associated project.',
        });
        return;
      }
    }

    const taskObj = task.toObject();
    res.status(200).json({
      task: {
        ...taskObj,
        isOverdue: computeIsOverdue(taskObj),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching task by ID:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to retrieve task',
    });
  }
};

/**
 * UPDATE TASK
 * PUT /api/tasks/:taskId
 * Managers & Admins have full field edit rights;
 * Assigned Employees can update fields permitted by business rules.
 */
export const updateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { title, description, priority, status, assignedTo, dueDate } = req.body;

    const actingUserObjId = await getActingUserObjectId(req);
    const userRole = req.user?.role;

    const task = await resolveTask(taskId);
    if (!task) {
      res.status(404).json({
        error: 'Not Found',
        message: `Task not found: ${taskId}`,
      });
      return;
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Associated project not found' });
      return;
    }

    // Authorization & Scope check for Employee
    if (userRole === 'employee') {
      if (!actingUserObjId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User context missing' });
        return;
      }

      // Check project membership
      const isMember = project.teamMembers.some(
        (m) => m.toString() === actingUserObjId.toString()
      );
      if (!isMember) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You are not a team member of this project.',
        });
        return;
      }

      // Check task assignment: Employee can only update tasks assigned to them
      if (!task.assignedTo || task.assignedTo.toString() !== actingUserObjId.toString()) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. Employees can only update tasks assigned directly to them.',
        });
        return;
      }

      // Employees cannot reassign or change core project ownership
      if (assignedTo !== undefined) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Employees cannot reassign tasks. Contact a manager or admin.',
        });
        return;
      }
    }

    // Save previous snapshot for audit
    const rawPrevAssigned = task.assignedTo as any;
    const prevAssignedId = rawPrevAssigned
      ? (typeof rawPrevAssigned === 'object' && rawPrevAssigned._id ? rawPrevAssigned._id.toString() : rawPrevAssigned.toString())
      : null;

    const previousSnapshot = {
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignedTo: prevAssignedId,
      dueDate: task.dueDate,
    };

    // 1. Validate & Update Title
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length < 2) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Task title must be at least 2 characters',
        });
        return;
      }
      task.title = title.trim();
    }

    // 2. Update Description
    if (description !== undefined) {
      task.description = String(description).trim();
    }

    // 3. Validate & Update Priority
    if (priority !== undefined) {
      const normPriority = String(priority).toLowerCase() as TaskPriority;
      if (!ALLOWED_PRIORITIES.includes(normPriority)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Invalid priority: ${priority}. Allowed: ${ALLOWED_PRIORITIES.join(', ')}`,
        });
        return;
      }
      task.priority = normPriority;
    }

    // 4. Validate & Update Status (State machine transition check)
    if (status !== undefined) {
      const normStatus = String(status).toLowerCase() as TaskStatus;
      if (!ALLOWED_STATUSES.includes(normStatus)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Invalid task status: ${status}. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
        return;
      }

      if (normStatus !== task.status) {
        const allowedNext = VALID_TRANSITIONS[task.status] || [];
        if (!allowedNext.includes(normStatus)) {
          res.status(400).json({
            error: 'Invalid Transition',
            message: `Invalid status transition from '${task.status}' to '${normStatus}'. Allowed transitions: ${
              allowedNext.length > 0 ? allowedNext.join(', ') : 'none (terminal state)'
            }`,
          });
          return;
        }
        task.status = normStatus;
      }
    }

    // 5. Validate & Update Assigned User (Manager/Admin only)
    if (assignedTo !== undefined) {
      if (assignedTo === null || assignedTo === '') {
        task.assignedTo = undefined;
      } else {
        let targetUser: IUser | null = null;
        if (mongoose.Types.ObjectId.isValid(assignedTo)) {
          targetUser = await User.findOne({
            $or: [{ _id: assignedTo }, { userId: assignedTo }],
          });
        } else {
          targetUser = await User.findOne({ userId: assignedTo });
        }

        if (!targetUser) {
          res.status(400).json({
            error: 'Validation Error',
            message: `Assignee user not found: ${assignedTo}`,
          });
          return;
        }

        // Verify active team membership in this project
        const isMember = project.teamMembers.some(
          (m) => m.toString() === targetUser!._id.toString()
        );
        if (!isMember) {
          res.status(400).json({
            error: 'Validation Error',
            message: `User ${targetUser.name} (${targetUser.userId}) is not an active team member of project "${project.name}"`,
          });
          return;
        }

        task.assignedTo = targetUser._id as Types.ObjectId;
      }
    }

    // 6. Validate & Update Due Date
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        task.dueDate = undefined;
      } else {
        const parsed = new Date(dueDate);
        if (isNaN(parsed.getTime())) {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid dueDate format',
          });
          return;
        }
        task.dueDate = parsed;
      }
    }

    await task.save();

    await task.populate([
      { path: 'assignedTo', select: '_id userId name email role' },
      { path: 'projectId', select: '_id projectId name status deadline teamMembers' },
      { path: 'comments.userId', select: '_id userId name email role' },
    ]);

    // 7. Audit Log
    if (actingUserObjId) {
      const rawNewAssigned = task.assignedTo as any;
      const newAssignedId = rawNewAssigned
        ? (typeof rawNewAssigned === 'object' && rawNewAssigned._id ? rawNewAssigned._id.toString() : rawNewAssigned.toString())
        : null;

      const newSnapshot = {
        taskId: task.taskId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignedTo: newAssignedId,
        dueDate: task.dueDate,
      };

      const statusChanged = previousSnapshot.status !== newSnapshot.status;
      const assignmentChanged = previousSnapshot.assignedTo !== newSnapshot.assignedTo;

      let actionName = 'UPDATE_TASK';
      if (statusChanged && !assignmentChanged) {
        actionName = 'TASK_STATUS_CHANGED';
      } else if (assignmentChanged && !statusChanged) {
        actionName = 'ASSIGN_TASK';
      }

      await Activity.create({
        userId: actingUserObjId,
        action: actionName,
        entity: 'Task',
        previousValue: previousSnapshot,
        newValue: newSnapshot,
        timestamp: new Date(),
      });
    }

    const taskObj = task.toObject();
    res.status(200).json({
      message: 'Task updated successfully',
      task: {
        ...taskObj,
        isOverdue: computeIsOverdue(taskObj),
      },
    });
  } catch (error: unknown) {
    console.error('Error updating task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to update task',
    });
  }
};

/**
 * ASSIGN / REASSIGN TASK
 * PUT /api/tasks/:taskId/assign
 * Managers & Admins only
 */
export const assignTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { assignedTo } = req.body;

    const actingUserObjId = await getActingUserObjectId(req);

    const task = await resolveTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Not Found', message: `Task not found: ${taskId}` });
      return;
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Associated project not found' });
      return;
    }

    const previousAssignedTo = task.assignedTo ? task.assignedTo.toString() : null;
    let newAssignedObjId: Types.ObjectId | undefined;

    if (assignedTo !== null && assignedTo !== undefined && assignedTo !== '') {
      let targetUser: IUser | null = null;
      if (mongoose.Types.ObjectId.isValid(assignedTo)) {
        targetUser = await User.findOne({
          $or: [{ _id: assignedTo }, { userId: assignedTo }],
        });
      } else {
        targetUser = await User.findOne({ userId: assignedTo });
      }

      if (!targetUser) {
        res.status(400).json({
          error: 'Validation Error',
          message: `User to assign not found: ${assignedTo}`,
        });
        return;
      }

      // Check active project membership
      const isMember = project.teamMembers.some(
        (m) => m.toString() === targetUser!._id.toString()
      );
      if (!isMember) {
        res.status(400).json({
          error: 'Validation Error',
          message: `User ${targetUser.name} is not an active team member of project "${project.name}"`,
        });
        return;
      }

      newAssignedObjId = targetUser._id as Types.ObjectId;
      task.assignedTo = newAssignedObjId;
    } else {
      task.assignedTo = undefined;
    }

    await task.save();

    await task.populate([
      { path: 'assignedTo', select: '_id userId name email role' },
      { path: 'projectId', select: '_id projectId name status deadline teamMembers' },
      { path: 'comments.userId', select: '_id userId name email role' },
    ]);

    // Audit record
    if (actingUserObjId) {
      await Activity.create({
        userId: actingUserObjId,
        action: 'ASSIGN_TASK',
        entity: 'Task',
        previousValue: { taskId: task.taskId, assignedTo: previousAssignedTo },
        newValue: { taskId: task.taskId, assignedTo: newAssignedObjId ? newAssignedObjId.toString() : null },
        timestamp: new Date(),
      });
    }

    const taskObj = task.toObject();
    res.status(200).json({
      message: 'Task assignment updated',
      task: {
        ...taskObj,
        isOverdue: computeIsOverdue(taskObj),
      },
    });
  } catch (error: unknown) {
    console.error('Error assigning task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to update assignment',
    });
  }
};

/**
 * CHANGE TASK STATUS
 * PATCH /api/tasks/:taskId/status
 * Accessible to Manager/Admin or assigned Employee of project
 */
export const changeTaskStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const actingUserObjId = await getActingUserObjectId(req);
    const userRole = req.user?.role;

    if (!status || typeof status !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Status string is required',
      });
      return;
    }

    const normStatus = status.toLowerCase() as TaskStatus;
    if (!ALLOWED_STATUSES.includes(normStatus)) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Invalid status: ${status}. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
      });
      return;
    }

    const task = await resolveTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Not Found', message: `Task not found: ${taskId}` });
      return;
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Associated project not found' });
      return;
    }

    // Role-based check
    if (userRole === 'employee') {
      if (!actingUserObjId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User session invalid' });
        return;
      }
      const isMember = project.teamMembers.some((m) => m.toString() === actingUserObjId.toString());
      if (!isMember) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You are not a member of this project.',
        });
        return;
      }
      if (!task.assignedTo || task.assignedTo.toString() !== actingUserObjId.toString()) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You can only update the status of tasks assigned to you.',
        });
        return;
      }
    }

    // State machine check
    if (normStatus !== task.status) {
      const allowedNext = VALID_TRANSITIONS[task.status] || [];
      if (!allowedNext.includes(normStatus)) {
        res.status(400).json({
          error: 'Invalid Transition',
          message: `Invalid status transition from '${task.status}' to '${normStatus}'. Allowed transitions: ${
            allowedNext.length > 0 ? allowedNext.join(', ') : 'none'
          }`,
        });
        return;
      }
    }

    const previousStatus = task.status;
    task.status = normStatus;
    await task.save();

    await task.populate([
      { path: 'assignedTo', select: '_id userId name email role' },
      { path: 'projectId', select: '_id projectId name status deadline teamMembers' },
      { path: 'comments.userId', select: '_id userId name email role' },
    ]);

    // Audit Logging
    if (actingUserObjId) {
      await Activity.create({
        userId: actingUserObjId,
        action: 'TASK_STATUS_CHANGED',
        entity: 'Task',
        previousValue: { taskId: task.taskId, status: previousStatus },
        newValue: { taskId: task.taskId, status: task.status },
        timestamp: new Date(),
      });
    }

    const taskObj = task.toObject();
    res.status(200).json({
      message: `Task status transitioned to ${task.status}`,
      task: {
        ...taskObj,
        isOverdue: computeIsOverdue(taskObj),
      },
    });
  } catch (error: unknown) {
    console.error('Error changing task status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to change task status',
    });
  }
};

/**
 * ADD COMMENT / ACTIVITY TO TASK
 * POST /api/tasks/:taskId/comments
 * Accessible to team members of the project or Manager/Admin
 */
export const addTaskComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    const actingUserObjId = await getActingUserObjectId(req);
    const userRole = req.user?.role;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Comment text is required',
      });
      return;
    }

    const task = await resolveTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Not Found', message: `Task not found: ${taskId}` });
      return;
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Associated project not found' });
      return;
    }

    // Role-based check for employees
    if (userRole === 'employee') {
      if (!actingUserObjId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User session invalid' });
        return;
      }
      const isMember = project.teamMembers.some((m) => m.toString() === actingUserObjId.toString());
      if (!isMember) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You are not a member of this project.',
        });
        return;
      }
    }

    if (!actingUserObjId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User session invalid' });
      return;
    }

    const comment = {
      userId: actingUserObjId,
      text: text.trim(),
      timestamp: new Date(),
    };

    task.comments.push(comment as unknown as { userId: Types.ObjectId; text: string; timestamp: Date });
    await task.save();

    await task.populate([
      { path: 'assignedTo', select: '_id userId name email role' },
      { path: 'projectId', select: '_id projectId name status deadline teamMembers' },
      { path: 'comments.userId', select: '_id userId name email role' },
    ]);

    // Audit log
    await Activity.create({
      userId: actingUserObjId,
      action: 'ADD_TASK_COMMENT',
      entity: 'Task',
      previousValue: { taskId: task.taskId },
      newValue: { taskId: task.taskId, commentText: text.trim().substring(0, 100) },
      timestamp: new Date(),
    });

    const taskObj = task.toObject();
    res.status(201).json({
      message: 'Comment added successfully',
      task: {
        ...taskObj,
        isOverdue: computeIsOverdue(taskObj),
      },
    });
  } catch (error: unknown) {
    console.error('Error adding comment to task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to add comment',
    });
  }
};

/**
 * DELETE TASK
 * DELETE /api/tasks/:taskId
 * Managers & Admins only
 */
export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const actingUserObjId = await getActingUserObjectId(req);

    const task = await resolveTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Not Found', message: `Task not found: ${taskId}` });
      return;
    }

    const snapshot = {
      taskId: task.taskId,
      title: task.title,
      projectId: task.projectId.toString(),
      assignedTo: task.assignedTo ? task.assignedTo.toString() : null,
      status: task.status,
    };

    await Task.deleteOne({ _id: task._id });

    // Audit log
    if (actingUserObjId) {
      await Activity.create({
        userId: actingUserObjId,
        action: 'DELETE_TASK',
        entity: 'Task',
        previousValue: snapshot,
        newValue: null,
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      message: `Task ${task.taskId} deleted successfully`,
      taskId: task.taskId,
    });
  } catch (error: unknown) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to delete task',
    });
  }
};

/**
 * GET TASK ACTIVITIES / AUDIT TRAIL
 * GET /api/tasks/:taskId/activities
 */
export const getTaskActivities = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const { taskId } = req.params;
    const actingUserObjId = await getActingUserObjectId(req);
    const userRole = req.user.role;

    const task = await resolveTask(taskId);
    if (!task) {
      if (userRole === 'admin' || userRole === 'manager') {
        const activities = await Activity.find({
          entity: 'Task',
          $or: [
            { 'newValue.taskId': taskId },
            { 'previousValue.taskId': taskId },
          ],
        })
          .populate('userId', '_id userId name email role')
          .sort({ timestamp: -1 })
          .limit(50);

        if (activities.length > 0) {
          res.status(200).json({ activities });
          return;
        }
      }
      res.status(404).json({ error: 'Not Found', message: `Task not found: ${taskId}` });
      return;
    }

    // Role-based access check: If employee, must belong to the associated project
    if (userRole === 'employee') {
      const project = await Project.findById(task.projectId);
      if (!project) {
        res.status(404).json({ error: 'Not Found', message: 'Associated project not found' });
        return;
      }
      const isMember = project.teamMembers.some(
        (m) => actingUserObjId && m.toString() === actingUserObjId.toString()
      );
      if (!isMember) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You are not a team member of the associated project.',
        });
        return;
      }
    }

    const targetTaskId = task.taskId;
    const targetObjIdStr = task._id.toString();

    const orConditions: Record<string, unknown>[] = [
      { 'newValue.taskId': targetTaskId },
      { 'previousValue.taskId': targetTaskId },
      { 'newValue.taskId': targetObjIdStr },
      { 'previousValue.taskId': targetObjIdStr },
    ];

    const activities = await Activity.find({
      entity: 'Task',
      $or: orConditions,
    })
      .populate('userId', '_id userId name email role')
      .sort({ timestamp: -1 })
      .limit(50);

    res.status(200).json({ activities });
  } catch (error: unknown) {
    console.error('Error fetching task activities:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to retrieve task activities',
    });
  }
};
