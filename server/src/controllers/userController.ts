import { Response } from 'express';
import { User } from '../models/User.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

/**
 * Get all users (sanitized, no passwordHash)
 * GET /api/users
 */
export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({}, { _id: 1, userId: 1, name: 1, email: 1, role: 1, createdAt: 1 }).sort({ name: 1 });
    res.status(200).json({ users });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch users';
    console.error('getUsers error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve user list',
    });
  }
};
