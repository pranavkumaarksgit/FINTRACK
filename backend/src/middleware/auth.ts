import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserResponse, userStore } from '../models/userStore.js';

export interface AuthenticatedRequest extends Request {
  user?: UserResponse;
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Authorization header is missing'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Authorization header must be Bearer token'
    });
  }

  const token = parts[1];
  const secretKey = process.env.JWT_SECRET_KEY || 'fintrack_default_jwt_secret_dev';

  try {
    const decoded = jwt.verify(token, secretKey) as any;

    // Invalidate existing sessions/tokens after password reset
    if (decoded && decoded.id) {
      const user = userStore.findByIdSync(decoded.id);
      if (user) {
        // If JWT contains tokenVersion and doesn't match current user version, session is invalidated
        if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
          if (decoded.tokenVersion !== user.tokenVersion) {
            return res.status(401).json({
              success: false,
              message: 'Session has expired due to password reset. Please log in again.'
            });
          }
        } else if (user.passwordChangedAt && decoded.iat) {
          if (decoded.iat * 1000 <= user.passwordChangedAt) {
            return res.status(401).json({
              success: false,
              message: 'Session has expired due to password reset. Please log in again.'
            });
          }
        }
      }
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token'
    });
  }
}
