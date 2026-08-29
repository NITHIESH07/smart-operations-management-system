import { Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { Project, IProject, ProjectStatus } from '../models/Project.ts';
import { User } from '../models/User.ts';
import { Task } from '../models/Task.ts';
import { Activity } from '../models/Activity.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

const ALLOWED_STATUSES: ProjectStatus[] = ['planned', 'active', 'completed', 'cancelled'];

/**
 * Generate a unique human-readable Project ID (e.g. PRJ-172483-4921)
 */
const generateProjectId = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PRJ-${timestamp}-${random}`;
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
 * Helper to validate team members array
 */
const validateAndResolveTeamMembers = async (
  teamMemberIds: unknown[]
): Promise<{ valid: boolean; resolvedIds: Types.ObjectId[]; error?: string }> => {
  if (!Array.isArray(teamMemberIds)) {
    return { valid: false, resolvedIds: [], error: 'teamMembers must be an array' };
  }

  const resolvedIds: Types.ObjectId[] = [];
  const seen = new Set<string>();

  for (const id of teamMemberIds) {
    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return { valid: false, resolvedIds: [], error: `Invalid team member user ID format: ${id}` };
    }
    if (!seen.has(id)) {
      seen.add(id);
      resolvedIds.push(new Types.ObjectId(id));
    }
  }

  if (resolvedIds.length > 0) {
    const existingUsers = await User.find({ _id: { $in: resolvedIds } }, { _id: 1 });
    if (existingUsers.length !== resolvedIds.length) {
      return {
        valid: false,
        resolvedIds: [],
        error: 'One or more specified team members do not exist in the database',
      };
    }
  }

  return { valid: true, resolvedIds };
};

/**
 * Create Project
 * POST /api/projects
 */
export const createProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description, startDate, deadline, status, teamMembers } = req.body;

    // 1. Validate Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Project name is required and must be at least 2 characters',
      });
      return;
    }

    // 2. Validate Status
    let projectStatus: ProjectStatus = 'planned';
    if (status) {
      if (!ALLOWED_STATUSES.includes(status as ProjectStatus)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Invalid project status: ${status}. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
        return;
      }
      projectStatus = status as ProjectStatus;
    }

    // 3. Validate Dates
    let parsedStartDate: Date | undefined;
    let parsedDeadline: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid startDate format',
        });
        return;
      }
    }

    if (deadline) {
      parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime())) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid deadline format',
        });
        return;
      }
    }

    if (parsedStartDate && parsedDeadline && parsedDeadline.getTime() < parsedStartDate.getTime()) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Project deadline cannot be earlier than start date',
      });
      return;
    }

    // 4. Validate Team Members
    let resolvedTeamMembers: Types.ObjectId[] = [];
    if (teamMembers && Array.isArray(teamMembers)) {
      const validation = await validateAndResolveTeamMembers(teamMembers);
      if (!validation.valid) {
        res.status(400).json({
          error: 'Validation Error',
          message: validation.error,
        });
        return;
      }
      resolvedTeamMembers = validation.resolvedIds;
    }

    // 5. Generate unique Project ID
    const projectId = generateProjectId();

    // 6. Create Project in DB
    const newProject = await Project.create({
      projectId,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      startDate: parsedStartDate,
      deadline: parsedDeadline,
      status: projectStatus,
      teamMembers: resolvedTeamMembers,
    });

    const populatedProject = await Project.findById(newProject._id).populate(
      'teamMembers',
      '_id userId name email role'
    );

    // 7. Audit Log / Activity Record
    const actingUserObjId = await getActingUserObjectId(req);
    if (actingUserObjId) {
      await Activity.create({
        userId: actingUserObjId,
        action: 'CREATE_PROJECT',
        entity: 'Project',
        newValue: {
          projectId: newProject.projectId,
          name: newProject.name,
          status: newProject.status,
          teamMembersCount: resolvedTeamMembers.length,
        },
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      message: 'Project created successfully',
      project: populatedProject,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Project creation failed';
    console.error('createProject Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while creating project',
    });
  }
};

/**
 * Get All Projects
 * GET /api/projects
 * - Admins/Managers: view all projects
 * - Employees: view only projects where their ObjectId exists in teamMembers
 */
export const getProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    let filter: Record<string, unknown> = {};

    if (req.user.role === 'employee') {
      const actingUserObjId = await getActingUserObjectId(req);
      if (!actingUserObjId) {
        res.status(200).json({ projects: [] });
        return;
      }
      filter = { teamMembers: actingUserObjId };
    }

    const projects = await Project.find(filter)
      .populate('teamMembers', '_id userId name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({ projects });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch projects';
    console.error('getProjects Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching projects',
    });
  }
};

/**
 * Get Single Project by ID
 * GET /api/projects/:projectId
 */
export const getProjectById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const { projectId } = req.params;

    const isMongoId = mongoose.Types.ObjectId.isValid(projectId);
    const query = isMongoId ? { $or: [{ projectId }, { _id: projectId }] } : { projectId };

    const project = await Project.findOne(query).populate('teamMembers', '_id userId name email role');

    if (!project) {
      res.status(404).json({
        error: 'Not Found',
        message: `Project with identifier '${projectId}' was not found`,
      });
      return;
    }

    // Role-based access check for employee
    if (req.user.role === 'employee') {
      const actingUserObjId = await getActingUserObjectId(req);
      const isMember = project.teamMembers.some((member: any) => {
        const memberIdStr = member._id ? member._id.toString() : member.toString();
        return actingUserObjId && memberIdStr === actingUserObjId.toString();
      });

      if (!isMember) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You are not assigned to this project.',
        });
        return;
      }
    }

    res.status(200).json({ project });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch project';
    console.error('getProjectById Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching project details',
    });
  }
};

/**
 * Update Project
 * PUT /api/projects/:projectId
 */
export const updateProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { name, description, startDate, deadline, status, teamMembers } = req.body;

    const isMongoId = mongoose.Types.ObjectId.isValid(projectId);
    const query = isMongoId ? { $or: [{ projectId }, { _id: projectId }] } : { projectId };

    const project = await Project.findOne(query);

    if (!project) {
      res.status(404).json({
        error: 'Not Found',
        message: `Project '${projectId}' not found`,
      });
      return;
    }

    // Store previous values for audit log
    const previousSnapshot = {
      projectId: project.projectId,
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      deadline: project.deadline,
      teamMembersCount: project.teamMembers.length,
    };

    // 1. Validate & Update Name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Project name must be at least 2 characters',
        });
        return;
      }
      project.name = name.trim();
    }

    // 2. Validate & Update Description
    if (description !== undefined) {
      project.description = typeof description === 'string' ? description.trim() : '';
    }

    // 3. Validate & Update Status
    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status as ProjectStatus)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Invalid project status: ${status}. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
        return;
      }
      project.status = status as ProjectStatus;
    }

    // 4. Validate & Update Dates
    let effectiveStartDate = project.startDate;
    let effectiveDeadline = project.deadline;

    if (startDate !== undefined) {
      if (startDate === null || startDate === '') {
        effectiveStartDate = undefined;
        project.startDate = undefined;
      } else {
        const parsed = new Date(startDate);
        if (isNaN(parsed.getTime())) {
          res.status(400).json({ error: 'Validation Error', message: 'Invalid startDate format' });
          return;
        }
        effectiveStartDate = parsed;
        project.startDate = parsed;
      }
    }

    if (deadline !== undefined) {
      if (deadline === null || deadline === '') {
        effectiveDeadline = undefined;
        project.deadline = undefined;
      } else {
        const parsed = new Date(deadline);
        if (isNaN(parsed.getTime())) {
          res.status(400).json({ error: 'Validation Error', message: 'Invalid deadline format' });
          return;
        }
        effectiveDeadline = parsed;
        project.deadline = parsed;
      }
    }

    if (
      effectiveStartDate &&
      effectiveDeadline &&
      effectiveDeadline.getTime() < effectiveStartDate.getTime()
    ) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Project deadline cannot be earlier than start date',
      });
      return;
    }

    // 5. Validate & Update Team Members
    if (teamMembers !== undefined) {
      const validation = await validateAndResolveTeamMembers(teamMembers);
      if (!validation.valid) {
        res.status(400).json({
          error: 'Validation Error',
          message: validation.error,
        });
        return;
      }
      project.teamMembers = validation.resolvedIds;
    }

    await project.save();

    const populatedProject = await Project.findById(project._id).populate(
      'teamMembers',
      '_id userId name email role'
    );

    // 6. Record Activity Audit Log
    const actingUserObjId = await getActingUserObjectId(req);
    if (actingUserObjId) {
      const newSnapshot = {
        projectId: project.projectId,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        deadline: project.deadline,
        teamMembersCount: project.teamMembers.length,
      };

      await Activity.create({
        userId: actingUserObjId,
        action: previousSnapshot.status !== project.status ? 'PROJECT_STATUS_CHANGED' : 'UPDATE_PROJECT',
        entity: 'Project',
        previousValue: previousSnapshot,
        newValue: newSnapshot,
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      message: 'Project updated successfully',
      project: populatedProject,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Project update failed';
    console.error('updateProject Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while updating project',
    });
  }
};

/**
 * Manage Project Team Members
 * PUT /api/projects/:projectId/team
 */
export const updateProjectTeam = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { teamMembers } = req.body;

    const isMongoId = mongoose.Types.ObjectId.isValid(projectId);
    const query = isMongoId ? { $or: [{ projectId }, { _id: projectId }] } : { projectId };

    const project = await Project.findOne(query);

    if (!project) {
      res.status(404).json({
        error: 'Not Found',
        message: `Project '${projectId}' not found`,
      });
      return;
    }

    const validation = await validateAndResolveTeamMembers(teamMembers);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation Error',
        message: validation.error,
      });
      return;
    }

    const previousTeamCount = project.teamMembers.length;
    project.teamMembers = validation.resolvedIds;
    await project.save();

    const populatedProject = await Project.findById(project._id).populate(
      'teamMembers',
      '_id userId name email role'
    );

    // Audit Log
    const actingUserObjId = await getActingUserObjectId(req);
    if (actingUserObjId) {
      await Activity.create({
        userId: actingUserObjId,
        action: 'UPDATE_PROJECT_TEAM',
        entity: 'Project',
        previousValue: { projectId: project.projectId, teamMembersCount: previousTeamCount },
        newValue: { projectId: project.projectId, teamMembersCount: project.teamMembers.length },
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      message: 'Project team updated successfully',
      project: populatedProject,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Team update failed';
    console.error('updateProjectTeam Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while updating project team members',
    });
  }
};

/**
 * Delete Project
 * DELETE /api/projects/:projectId
 */
export const deleteProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    const isMongoId = mongoose.Types.ObjectId.isValid(projectId);
    const query = isMongoId ? { $or: [{ projectId }, { _id: projectId }] } : { projectId };

    const project = await Project.findOne(query);

    if (!project) {
      res.status(404).json({
        error: 'Not Found',
        message: `Project '${projectId}' not found`,
      });
      return;
    }

    // Safety check: Prevent deletion if tasks exist for this project
    const associatedTasksCount = await Task.countDocuments({ projectId: project._id });
    if (associatedTasksCount > 0) {
      res.status(409).json({
        error: 'Conflict',
        message: `Cannot delete project '${project.name}'. It contains ${associatedTasksCount} associated task(s). Please remove or reassign tasks first.`,
      });
      return;
    }

    const previousSnapshot = {
      projectId: project.projectId,
      name: project.name,
      status: project.status,
    };

    await Project.deleteOne({ _id: project._id });

    // Activity Log
    const actingUserObjId = await getActingUserObjectId(req);
    if (actingUserObjId) {
      await Activity.create({
        userId: actingUserObjId,
        action: 'DELETE_PROJECT',
        entity: 'Project',
        previousValue: previousSnapshot,
        newValue: null,
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      message: 'Project deleted successfully',
      projectId: project.projectId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Project deletion failed';
    console.error('deleteProject Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while deleting project',
    });
  }
};

/**
 * Get Activities for a project
 * GET /api/projects/:projectId/activities
 */
export const getProjectActivities = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const { projectId } = req.params;

    const isMongoId = mongoose.Types.ObjectId.isValid(projectId);
    const project = await Project.findOne(
      isMongoId ? { $or: [{ projectId }, { _id: projectId }] } : { projectId }
    );

    if (!project) {
      if (req.user.role === 'admin' || req.user.role === 'manager') {
        const activities = await Activity.find({
          entity: 'Project',
          $or: [
            { 'newValue.projectId': projectId },
            { 'previousValue.projectId': projectId },
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

      res.status(404).json({
        error: 'Not Found',
        message: `Project '${projectId}' not found`,
      });
      return;
    }

    // Role-based access check: Employee must belong to project team
    if (req.user.role === 'employee') {
      const actingUserObjId = await getActingUserObjectId(req);
      const isMember = project.teamMembers.some((member: any) => {
        const memberIdStr = member._id ? member._id.toString() : member.toString();
        return actingUserObjId && memberIdStr === actingUserObjId.toString();
      });

      if (!isMember) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You are not assigned to this project.',
        });
        return;
      }
    }

    const targetProjectId = project.projectId;
    const targetObjIdStr = project._id.toString();

    const orConditions: Record<string, unknown>[] = [
      { 'newValue.projectId': targetProjectId },
      { 'previousValue.projectId': targetProjectId },
      { 'newValue.projectId': targetObjIdStr },
      { 'previousValue.projectId': targetObjIdStr },
    ];

    const activities = await Activity.find({
      entity: 'Project',
      $or: orConditions,
    })
      .populate('userId', '_id userId name email role')
      .sort({ timestamp: -1 })
      .limit(50);

    res.status(200).json({ activities });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch activities';
    console.error('getProjectActivities Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve project activity log',
    });
  }
};
