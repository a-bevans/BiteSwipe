# BiteSwipe Backend

## Authentication System

BiteSwipe uses Google authentication to secure API endpoints. The system:

- Verifies Google ID tokens for all protected routes
- Validates that users can only perform actions with their own email address
- Bypasses authentication in test mode for easier testing

## Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Update the `.env` file with your own values:
- `PORT`: The port number for the server (default: 3000)
- `DB_URI`: MongoDB connection string (default: mongodb://localhost:27017/biteswipe)
- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key
- `YELP_API_KEY`: Your Yelp API key
- `REDIS_URL`: Redis connection string (default: redis://localhost:6379)
- `GOOGLE_WEB_CLIENT_ID`: Your Google Web Client ID for authentication
- `GOOGLE_TEST_EMAIL`: Email for Google authentication in tests (required for running tests)

Note: The `.env` file is ignored by git to keep your API keys and sensitive information private. Each developer should maintain their own `.env` file based on the `.env.example` template.

## Testing with Google Authentication

For unmocked tests, the backend uses a simplified test authentication system. The test setup automatically handles authentication by bypassing the Google token verification in test mode.

### Required Environment Variables for Tests

Make sure these variables are set in your `.env` file:

```
GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
GOOGLE_TEST_EMAIL=your-test-email@example.com
```

Note: `GOOGLE_TEST_EMAIL` is required for running tests. The authentication middleware will throw an error if this environment variable is not set in test mode.

### Using Authentication in Tests

The unmocked test setup automatically creates an authenticated agent that you can use in your tests. Simply import it from the unmocked_setup file:

```typescript
import { authenticatedAgent } from './unmocked_setup';

// Now all requests will automatically include the test authentication
const response = await authenticatedAgent.get('/protected-endpoint');
```

This approach automatically handles authentication for all requests made with the agent, so you don't need to manually add tokens to each request.

If you need to create a separate authenticated agent (which is rarely needed), you can use the `createAuthenticatedAgent` function directly:

```typescript
import { createAuthenticatedAgent } from './test_setup_auth';
import { createApp } from '../../app';

const app = createApp();
const customAgent = createAuthenticatedAgent(app);
```

## Email Validation

The backend implements email validation to ensure users can only perform actions with their own email address:

1. For user creation endpoints, the email in the request body must match the authenticated user's email
2. For friend-related endpoints, the email in the URL must match the authenticated user's email
3. This validation is skipped in test mode to allow tests to run properly

This prevents impersonation attacks and ensures users can only access their own data.
