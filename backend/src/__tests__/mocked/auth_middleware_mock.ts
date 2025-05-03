// Mock the authentication middleware
jest.mock('../../middleware/authMiddleware', () => {
  return {
    verifyGoogleToken: jest.fn().mockImplementation((req, res, next) => {
      // Set mock user data on the request
      req.userId = 'test-user-id';
      req.userEmail = 'test@example.com';
      next();
    }),
    requireAuth: jest.fn().mockImplementation((req, res, next) => {
      // Always allow access in tests
      next();
    })
  };
});
