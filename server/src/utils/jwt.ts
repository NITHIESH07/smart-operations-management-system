import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { UserRole } from '../models/User.ts';

export interface JwtUserPayload {
  _id?: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

const getJwtSecret = (): Secret => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fallback development secret with clear warning
    console.warn('⚠️  JWT_SECRET environment variable is not defined. Using default fallback development secret.');
    return 'default_smart_operations_dev_secret_key_32_chars';
  }
  return secret;
};

const getJwtExpiresIn = (): string => {
  return process.env.JWT_EXPIRES_IN || '7d';
};

/**
 * Generates a signed JWT for the authenticated user.
 */
export const generateToken = (payload: JwtUserPayload): string => {
  const secret = getJwtSecret();
  const options: SignOptions = {
    expiresIn: getJwtExpiresIn() as unknown as number, // jsonwebtoken types accept string like '7d'
  };
  return jwt.sign(payload, secret, options);
};

/**
 * Verifies and decodes a JWT token.
 * Returns the decoded JwtUserPayload or throws an error on failure.
 */
export const verifyToken = (token: string): JwtUserPayload => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as JwtUserPayload;
};
