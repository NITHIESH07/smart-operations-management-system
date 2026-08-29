import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtUserPayload } from '../utils/jwt.ts';
import { UserRole } from '../models/User.ts';

// Extend Express Request interface with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

/**
 * Authentication Middleware:
 * Verifies JWT token provided in the Authorization header.
 * Attaches decoded user payload to req.user.
 */
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header is missing',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authorization format. Expected format: Bearer <token>',
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid token';
    res.status(401).json({
      error: 'Unauthorized',
      message: errorMessage.includes('expired') ? 'Session token has expired' : 'Invalid session token',
    });
  }
};

/**
 * Role-Based Authorization Middleware:
 * Restricts route access to specific permitted user roles.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required to access this resource',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}. Your current role is: ${req.user.role}`,
      });
      return;
    }

    next();
  };
};
