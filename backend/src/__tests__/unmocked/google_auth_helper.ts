// No imports needed for the simplified test helper

/**
 * Helper function to get a Google authentication token for unmocked tests
 * This is a placeholder function since authentication is now bypassed in test mode
 * 
 * @returns Promise<string> - A dummy Google ID token
 */
export function getGoogleAuthToken(): Promise<string> {
  // Since authentication is bypassed in unmocked tests, we just return a dummy token
  // This token is never actually used for authentication
  return Promise.resolve('dummy-token-for-tests');
}

/**
 * Helper function to attach a Google authentication token to a supertest request
 * This is a placeholder function since authentication is now bypassed in test mode
 * 
 * @param request - The supertest request object
 * @returns The request with a dummy authentication header attached
 */
// Define a type for supertest request objects
interface SuperTestRequest {
  set(headerName: string, headerValue: string): SuperTestRequest;
}

/**
 * Helper function to attach a Google authentication token to a supertest request
 * This is a placeholder function since authentication is now bypassed in test mode
 * 
 * @param request - The supertest request object
 * @returns The request with a dummy authentication header attached
 */
export function attachGoogleAuthToken(request: SuperTestRequest): Promise<SuperTestRequest> {
  // Since authentication is bypassed in unmocked tests, we just attach a dummy token
  // This token is never actually used for authentication
  return Promise.resolve(request.set('Authorization', 'Bearer dummy-token-for-tests'));
}
