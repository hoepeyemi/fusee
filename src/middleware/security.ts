import { Request, Response, NextFunction } from 'express';

// Basic security headers middleware
export const helmetMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
};

// Simple rate limiting using memory store
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  const userRequests = requestCounts.get(ip);
  
  if (!userRequests || now > userRequests.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (userRequests.count >= maxRequests) {
    return res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
    });
  }

  userRequests.count++;
  next();
};

// Simple speed limiter
const speedLimits = new Map<string, { count: number; resetTime: number }>();

export const speedLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const delayAfter = 50;
  const delayMs = 500;

  const userSpeed = speedLimits.get(ip);
  
  if (!userSpeed || now > userSpeed.resetTime) {
    speedLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (userSpeed.count > delayAfter) {
    setTimeout(() => next(), delayMs);
  } else {
    userSpeed.count++;
    next();
  }
};

// XSS prevention middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Note: req.query is read-only in Express, so we sanitize it on access
  // The sanitization will happen when the route handlers access req.query
  // This is handled by the sanitizeQueryParams function below
  
  next();
};

// Helper function to sanitize query parameters when accessed
export const sanitizeQueryParams = (query: any): any => {
  if (!query || typeof query !== 'object') {
    return query;
  }
  return sanitizeObject(query);
};

// Helper function to sanitize objects recursively
const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
};

// Basic XSS sanitization
const sanitizeString = (str: string): string => {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/&/g, '&amp;');
};

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors: string[] = [];
  
  // Validate email
  if (!req.body.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(req.body.email)) {
    errors.push('Please provide a valid email address');
  }
  
  // Validate full name
  if (!req.body.fullName) {
    errors.push('Full name is required');
  } else if (req.body.fullName.length < 2 || req.body.fullName.length > 100) {
    errors.push('Full name must be between 2 and 100 characters');
  } else if (!/^[a-zA-Z\s'-]+$/.test(req.body.fullName)) {
    errors.push('Full name can only contain letters, spaces, hyphens, and apostrophes');
  }
  
  // Validate phone number (optional)
  if (req.body.phoneNumber && !isValidPhoneNumber(req.body.phoneNumber)) {
    errors.push('Please provide a valid phone number');
  }
  
  // Validate Solana wallet
  if (!req.body.solanaWallet) {
    errors.push('Solana wallet address is required');
  } else if (!isValidSolanaWallet(req.body.solanaWallet)) {
    errors.push('Solana wallet address must be a valid base58 encoded string between 32 and 44 characters');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors
    });
  }
  
  next();
};

// Helper validation functions
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
  return phoneRegex.test(phone);
};

const isValidSolanaWallet = (wallet: string): boolean => {
  return wallet.length >= 32 && wallet.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(wallet);
};

// User validation middleware
export const validateUser = (req: Request, res: Response, next: NextFunction) => {
  handleValidationErrors(req, res, next);
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};
