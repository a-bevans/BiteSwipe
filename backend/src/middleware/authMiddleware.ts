import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';

// Create a new OAuth client using your web client ID
// This should match the one used in the Android app
const CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;

if (!CLIENT_ID) {
  throw new Error('GOOGLE_WEB_CLIENT_ID environment variable is not set');
}

const client = new OAuth2Client(CLIENT_ID);

// Extend the Express Request type to include user information

declare module 'express' {
  interface Request {
    userId?: string;
    userEmail?: string;
  }
}

/**
 * Helper function to send authentication error responses
 */
const sendAuthError = (res: Response, message: string) => {
  return res.status(401).json({
    error: 'Authentication required',
    message
  });
};

/**
 * Middleware to verify Google ID tokens
 * Extracts the token from the Authorization header and verifies it
 * In test mode, authentication is bypassed
 */
export const verifyGoogleToken = async (req: Request, res: Response, next: NextFunction) => {
  // Skip authentication in test mode
  if (process.env.NODE_ENV === 'test' && process.env.TEST_TYPE === 'unmocked') {
    // Set default test user information
    req.userId = 'test-user-id';
    req.userEmail = process.env.GOOGLE_TEST_EMAIL;
    if (!req.userEmail) {
      throw new Error('GOOGLE_TEST_EMAIL environment variable is not set');
    }
    // Log a fixed message instead of using dynamic content
    console.log('Test mode: Authentication bypassed');
    next();
    return;
  }
  
  try {
    // Get the auth header
    const authHeader = req.headers.authorization;
    
    // If no auth header is present, return 401 Unauthorized
    if (!authHeader) {
      return sendAuthError(res, 'No authorization header present');
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return sendAuthError(res, 'Invalid authorization format, Bearer token required');
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Verify the token with Google (for non-test tokens or if test token parsing failed)
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    
    // Get the payload from the ticket
    const payload = ticket.getPayload();
    
    if (!payload) {
      return sendAuthError(res, 'Invalid token payload');
    }
    
    // Extract user information
    const userId = payload.sub;
    const email = payload.email;
    
    // Add user info to the request object for use in route handlers
    req.userId = userId;
    req.userEmail = email;
    
    // Log a fixed message instead of using dynamic content
    console.log('User successfully authenticated');
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return sendAuthError(res, 'Invalid or expired token');
  }
};

/**
 * Middleware to require authentication
 * Use this for routes that should only be accessible to authenticated users
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.userId) {
    return sendAuthError(res, 'User not authenticated');
  }
  next();
};
