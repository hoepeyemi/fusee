import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Simple CSRF token storage
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Generate CSRF token
export const generateCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const tokenExpiry = 24 * 60 * 60 * 1000; // 24 hours
  
  // Generate a new token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store token with expiry
  csrfTokens.set(ip, { token, expires: now + tokenExpiry });
  
  // Add token to response headers for frontend to use
  res.setHeader('X-CSRF-Token', token);
  
  next();
};

// Verify CSRF token
export const verifyCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF verification for GET requests
  if (req.method === 'GET') {
    return next();
  }
  
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Get token from header or body
  const token = req.headers['x-csrf-token'] as string || req.body._csrf;
  
  if (!token) {
    return res.status(403).json({
      message: 'CSRF token missing',
      error: 'Forbidden'
    });
  }
  
  // Get stored token
  const storedToken = csrfTokens.get(ip);
  
  if (!storedToken || now > storedToken.expires) {
    return res.status(403).json({
      message: 'CSRF token expired or invalid',
      error: 'Forbidden'
    });
  }
  
  if (storedToken.token !== token) {
    return res.status(403).json({
      message: 'Invalid CSRF token',
      error: 'Forbidden'
    });
  }
  
  next();
};

// CSRF token endpoint for frontend
export const getCSRFToken = (req: Request, res: Response) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const storedToken = csrfTokens.get(ip);
  
  res.json({
    csrfToken: storedToken?.token || null
  });
};
