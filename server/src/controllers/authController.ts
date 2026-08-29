import { Request, Response } from 'express';
import { User, UserRole } from '../models/User.ts';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.ts';
import { generateToken } from '../utils/jwt.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

/**
 * Generate a clean human-readable unique User ID (e.g. USR-172483-4921)
 */
const generateUserId = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `USR-${timestamp}-${random}`;
};

/**
 * User Registration Controller
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, adminSecret } = req.body;

    // 1. Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Name is required and must be at least 2 characters',
      });
      return;
    }

    if (!email || typeof email !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'A valid email address is required',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Please provide a valid email address format',
      });
      return;
    }

    // 2. Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        error: 'Validation Error',
        message: passwordValidation.message,
      });
      return;
    }

    // 3. Determine and enforce Role assignment security
    let assignedRole: UserRole = 'employee';

    if (role) {
      const requestedRole = (role as string).toLowerCase() as UserRole;
      if (!['admin', 'manager', 'employee'].includes(requestedRole)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid role specified. Allowed roles are: admin, manager, employee',
        });
        return;
      }

      // Security Rule: Public registration cannot freely claim admin privileges
      if (requestedRole === 'admin') {
        const expectedAdminSecret = process.env.ADMIN_REGISTRATION_SECRET || 'admin_secret_key_for_setup';
        if (!adminSecret || adminSecret !== expectedAdminSecret) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Admin account creation requires a valid administrative registration secret',
          });
          return;
        }
        assignedRole = 'admin';
      } else {
        assignedRole = requestedRole;
      }
    }

    // 4. Check for duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: 'A user with this email address already exists',
      });
      return;
    }

    // 5. Hash password and generate user
    const passwordHash = await hashPassword(password);
    const userId = generateUserId();

    const newUser = await User.create({
      userId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: assignedRole,
    });

    // 6. Generate signed JWT token
    const token = generateToken({
      _id: newUser._id.toString(),
      userId: newUser.userId,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        _id: newUser._id,
        userId: newUser.userId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    console.error('Registration Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during user registration',
    });
  }
};

/**
 * User Login Controller
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required',
      });
      return;
    }

    const normalizedEmail = (email as string).toLowerCase().trim();

    // Query user and explicitly include passwordHash (which is select: false by default)
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      // Use uniform message to avoid account enumeration
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
      return;
    }

    // Verify password hash
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate signed JWT token
    const token = generateToken({
      _id: user._id.toString(),
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Login failed';
    console.error('Login Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during login',
    });
  }
};

/**
 * Get Authenticated User Profile
 * GET /api/auth/me
 */
export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
      });
      return;
    }

    // Retrieve fresh user document from MongoDB to reflect current database state
    const user = await User.findOne({ userId: req.user.userId });

    if (!user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'User account not found in database',
      });
      return;
    }

    res.status(200).json({
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Profile retrieval failed';
    console.error('GetMe Error:', errorMessage);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching user profile',
    });
  }
};
