import supertest from 'supertest';
import { Express } from 'express';
import { getGoogleAuthToken } from './google_auth_helper';

// Store the Google auth token for use in tests
let googleAuthToken: string | null = null;

/**
 * Setup function to run before all unmocked tests that require authentication
 * Since authentication is now bypassed in test mode, this function is simplified
 * to just get a dummy token for the Authorization header
 */
export const setupGoogleAuth = async (): Promise<void> => {
  try {
    // Check for required environment variables
    const email = process.env.GOOGLE_TEST_EMAIL;
    
    if (!email) {
      throw new Error('GOOGLE_TEST_EMAIL environment variable is not set');
    }
    
    // Get the dummy Google auth token
    googleAuthToken = await getGoogleAuthToken();
    console.log('Google authentication token obtained successfully');
  } catch (error) {
    console.error('Failed to set up Google authentication:', error);
    throw error;
  }
};

/**
 * Creates a supertest agent with Google authentication token automatically attached to all requests
 * 
 * @param app - The Express application to test
 * @returns A supertest agent that automatically includes the auth token in all requests
 */
export function createAuthenticatedAgent(app: Express): unknown {
  // Create a standard supertest agent
  const agent = supertest(app);
  
  // Create a proxy to intercept all method calls
  return new Proxy(agent, {
    get(target, prop) {
      // Get the original property
      const originalProp = target[prop as keyof typeof target];
      
      // If it's a function that creates a request (HTTP method)
      if (typeof originalProp === 'function' && [
        'get', 'post', 'put', 'delete', 'patch', 'head', 'options'
      ].includes(prop as string)) {
        // Return a wrapped function that adds the auth header
        return function(...args: unknown[]) {
          // Call the original method to get the request
          // Using Function.prototype.apply to preserve 'this' context
          const request = Function.prototype.apply.call(originalProp, target, args);
          
          // Add the auth header if we have a token
          if (googleAuthToken) {
            return request.set('Authorization', `Bearer ${googleAuthToken}`);
          }
          
          return request;
        };
      }
      
      // Return the original property for anything else
      return originalProp;
    }
  });
}
