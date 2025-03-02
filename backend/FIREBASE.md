# Firebase Setup for BiteSwipe

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in BiteSwipe.

## Prerequisites

1. A Google account
2. Access to [Firebase Console](https://console.firebase.google.com)
3. Node.js and npm installed

## Setup Steps

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project"
3. Name your project (e.g., "biteswipe")
4. Follow the setup wizard

### 2. Get Service Account Credentials

1. In Firebase Console, go to Project Settings (⚙️)
2. Go to "Service accounts" tab
3. Click "Generate New Private Key"
4. Save the downloaded file as `firebase-service-account.json` in the backend root directory
5. Keep this file secure and never commit it to git!

### 3. Update Environment Variables

1. Copy the following variables to your `.env` file:
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

### 4. Mobile App Setup

In your mobile app:

1. Initialize Firebase
2. Request notification permissions
3. Get the FCM token
4. Send the token to our backend:
```typescript
// After getting FCM token
await axios.post(`/api/users/${userId}/fcm-token`, { fcmToken });
```

## Testing Notifications

1. Make sure a user has a valid FCM token stored
2. Add the user to a session
3. They should receive a push notification!

Example notification payload:
```json
{
    "notification": {
        "title": "New BiteSwipe Session Invite!",
        "body": "John has invited you to join their food session"
    },
    "data": {
        "sessionId": "session_id_here",
        "type": "SESSION_INVITE"
    }
}
```

## Security Notes

- Keep `firebase-service-account.json` secure and never commit it
- Use environment variables for sensitive data
- Only store FCM tokens for authenticated users
- Validate all user input before sending notifications

## Troubleshooting

1. **No notifications received:**
   - Check FCM token is properly stored
   - Verify permissions on mobile device
   - Check Firebase Console logs

2. **Authentication errors:**
   - Verify service account file is in correct location
   - Check environment variables are set correctly

3. **Invalid token errors:**
   - Token might be expired, request a new one
   - Ensure token is properly formatted

## Useful Links

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Console](https://console.firebase.google.com)
