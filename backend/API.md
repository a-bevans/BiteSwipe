# BiteSwipe API Documentation

This document describes the API endpoints available in the BiteSwipe backend service.

## Base URL

```
http://localhost:3000
```

## API Endpoints

### Users

#### Get User
Retrieves user information.

```http
GET /users/{userId}
```

**Parameters**
- `userId`: User ID (path parameter)

**Response**
- `200 OK`: Successfully retrieved user
```json
{
  "_id": "string",
  "email": "string",
  "displayName": "string",
  "fcmToken": "string",
  "sessionHistory": []
}
```
- `400 Bad Request`: Invalid user ID format
```json
{
  "error": "Invalid user ID format"
}
```
- `404 Not Found`: User does not exist
```json
{
  "error": "User not found"
}
```
- `500 Internal Server Error`: Server error occurred
```json
{
  "error": "Internal Server Error"
}
```

#### Create User
Creates a new user account.

```http
POST /users/
```

**Request Body**
```json
{
  "email": "string",
  "displayName": "string"
}
```

**Response**
- `201 Created`: User created successfully
```json
{
  "_id": "string",
  "email": "string",
  "displayName": "string",
  "fcmToken": "string",
  "sessionHistory": []
}
```
- `409 Conflict`: User already exists
```json
{
  "error": "User with this email already exists"
}
```
- `500 Internal Server Error`: Server error occurred
```json
{
  "error": "Internal Server Error"
}
```

#### Update FCM Token
Updates a user's Firebase Cloud Messaging token for notifications.

```http
POST /users/{userId}/fcm-token
```

**Parameters**
- `userId`: User ID (path parameter)

**Request Body**
```json
{
  "fcmToken": "string"
}
```

**Response**
- `200 OK`: Token updated successfully
```json
{
  "success": true
}
```
- `400 Bad Request`: Unable to update token
```json
{
  "error": "Unable to update FCM token"
}
```

### Sessions

#### List User Sessions
Returns all active sessions created by a user.

```http
GET /users/{userId}/sessions
```

**Parameters**
- `userId`: User ID (path parameter)

**Response**
- `200 OK`: Successfully retrieved sessions
```json
{
  "sessions": [{
    "_id": "string",
    "creator": "string",
    "settings": {
      "location": {
        "latitude": "number",
        "longitude": "number",
        "radius": "number"
      }
    },
    "participants": [{
      "userId": "string",
      "preferences": [{
        "restaurantId": "string",
        "liked": "boolean",
        "timestamp": "date"
      }]
    }],
    "restaurants": [{
      "restaurantId": "string",
      "score": "number",
      "totalVotes": "number",
      "positiveVotes": "number"
    }],
    "createdAt": "date",
    "expiresAt": "date"
  }]
}
```
- `400 Bad Request`: Unable to fetch sessions
```json
{
  "error": "Unable to fetch sessions"
}
```

#### Get Session
Retrieves detailed information about a specific session.

```http
GET /sessions/{sessionId}
```

**Parameters**
- `sessionId`: Session ID (path parameter)

**Response**
- `200 OK`: Successfully retrieved session
```json
{
  "_id": "string",
  "creator": {
    "_id": "string",
    "displayName": "string"
  },
  "settings": {
    "location": {
      "latitude": "number",
      "longitude": "number",
      "radius": "number"
    }
  },
  "participants": [{
    "userId": {
      "_id": "string",
      "displayName": "string"
    },
    "preferences": [{
      "restaurantId": "string",
      "liked": "boolean",
      "timestamp": "date"
    }]
  }],
  "restaurants": [{
    "restaurantId": "string",
    "score": "number",
    "totalVotes": "number",
    "positiveVotes": "number"
  }],
  "status": "string", // One of: 'ACTIVE', 'COMPLETED', 'PENDING'
  "createdAt": "date",
  "expiresAt": "date"
}
```
- `400 Bad Request`: Invalid session ID format
```json
{
  "error": "Invalid session ID format"
}
```
- `404 Not Found`: Session does not exist
```json
{
  "error": "Session not found"
}
```
- `500 Internal Server Error`: Server error occurred
```json
{
  "error": "Internal server error"
}
```

#### Create Session
Creates a new dining session.

```http
POST /sessions
```

**Request Body**
```json
{
  "userId": "string",    // MongoDB ObjectId
  "latitude": number,
  "longitude": number,
  "radius": number
}
```

**Response**
- `201 Created`: Session created successfully
```json
{
  "_id": "string",
  "creator": "string",
  "participants": [
    {
      "userId": "string",
      "preferences": []
    }
  ],
  "pendingInvitations": [],
  "status": "CREATED",
  "settings": {
    "location": {
      "latitude": number,
      "longitude": number,
      "radius": number
    }
  },
  "restaurants": [
    {
      "restaurantId": "string",
      "score": number,
      "totalVotes": number,
      "positiveVotes": number
    }
  ],
  "createdAt": "string",
  "expiresAt": "string"
}
```
- `400 Bad Request`: Invalid request parameters
```json
{
  "error": "Internal server error"
}
```

#### Create Session Invitation
Invites a user to join a session. The invited user will receive a push notification.

```http
POST /sessions/:sessionId/invitations
```

**Parameters**
- `sessionId`: Session ID (path parameter)

**Request Body**
```json
{
  "userId": "string"  // MongoDB ObjectId of the user to invite
}
```

**Response**
- `200 OK`: Successfully invited user
```json
{
  "_id": "string",
  "creator": "string",
  "participants": [
    {
      "userId": "string",
      "preferences": []
    }
  ],
  "pendingInvitations": ["string"],  // List of invited user IDs
  "status": "CREATED",
  "settings": {
    "location": {
      "latitude": number,
      "longitude": number,
      "radius": number
    }
  },
  "restaurants": [
    {
      "restaurantId": "string",
      "score": number,
      "totalVotes": number,
      "positiveVotes": number
    }
  ],
  "createdAt": "string",
  "expiresAt": "string"
}
```

- `400 Bad Request`: Invalid session or user ID format, or user is already a participant
```json
{
  "error": "User is already a participant"
}
```
- `404 Not Found`: Session not found
```json
{
  "error": "Session not found"
}
```

#### Join Session
Accept an invitation and join a session. User must have been invited first.

```http
POST /sessions/:sessionId/participants
```

**Parameters**
- `sessionId`: Session ID (path parameter)

**Request Body**
```json
{
  "userId": "string"  // MongoDB ObjectId of the user joining
}
```

**Response**
- `200 OK`: Successfully joined session
```json
{
  "_id": "string",
  "creator": "string",
  "participants": [
    {
      "userId": "string",
      "preferences": []
    }
  ],
  "pendingInvitations": ["string"],
  "status": "CREATED",
  "settings": {
    "location": {
      "latitude": number,
      "longitude": number,
      "radius": number
    }
  },
  "restaurants": [
    {
      "restaurantId": "string",
      "score": number,
      "totalVotes": number,
      "positiveVotes": number
    }
  ],
  "createdAt": "string",
  "expiresAt": "string"
}
```

- `400 Bad Request`: Invalid session or user ID format, or user is already a participant
```json
{
  "error": "User is already a participant"
}
```
- `403 Forbidden`: User has not been invited to this session
```json
{
  "error": "User has not been invited to this session"
}
```
- `404 Not Found`: Session not found
```json
{
  "error": "Session not found"
}
```

#### Leave Session
Leave a session as a participant. Note that the session creator cannot leave their own session.

```http
DELETE /sessions/:sessionId/participants/:userId
```

**Parameters**
- `sessionId`: Session ID (path parameter)
- `userId`: User ID (path parameter)

**Response**
- `200 OK`: Successfully left session
```json
{
  "_id": "string",
  "creator": "string",
  "participants": [
    {
      "userId": "string",
      "preferences": []
    }
  ],
  "pendingInvitations": ["string"],
  "status": "CREATED",
  "settings": {
    "location": {
      "latitude": number,
      "longitude": number,
      "radius": number
    }
  },
  "restaurants": [
    {
      "restaurantId": "string",
      "score": number,
      "totalVotes": number,
      "positiveVotes": number
    }
  ],
  "createdAt": "string",
  "expiresAt": "string"
}
```

- `400 Bad Request`: Invalid session or user ID format, or if creator tries to leave
```json
{
  "error": "Session creator cannot leave the session"
}
```
- `403 Forbidden`: User is not a participant in this session
```json
{
  "error": "User is not a participant in this session"
}
```
- `404 Not Found`: Session not found
```json
{
  "error": "Session not found"
}
```

#### Reject Session Invitation
Reject or cancel a pending invitation to join a session.

```http
DELETE /sessions/:sessionId/invitations/:userId
```

**Parameters**
- `sessionId`: Session ID (path parameter)
- `userId`: User ID (path parameter)

**Response**
- `200 OK`: Successfully rejected invitation
```json
{
  "_id": "string",
  "creator": "string",
  "participants": [
    {
      "userId": "string",
      "preferences": []
    }
  ],
  "pendingInvitations": ["string"],
  "status": "CREATED",
  "settings": {
    "location": {
      "latitude": number,
      "longitude": number,
      "radius": number
    }
  },
  "restaurants": [
    {
      "restaurantId": "string",
      "score": number,
      "totalVotes": number,
      "positiveVotes": number
    }
  ],
  "createdAt": "string",
  "expiresAt": "string"
}
```

- `400 Bad Request`: Invalid session or user ID format
```json
{
  "error": "Invalid session or user ID format"
}
```
- `403 Forbidden`: User has not been invited to this session
```json
{
  "error": "User has not been invited to this session"
}
```
- `404 Not Found`: Session not found
```json
{
  "error": "Session not found"
}
```

#### Get Restaurants in Session
Retrieves all restaurants associated with a session.

```http
GET /sessions/:sessionId/restaurants
```

**Parameters**
- `sessionId`: Session ID (path parameter)

**Response**
- `200 OK`: Successfully retrieved restaurants
```json
[
  {
    "restaurantId": "string",
    "name": "string",
    "address": "string",
    "latitude": number,
    "longitude": number,
    "photoUrl": "string",
    "rating": number,
    "priceLevel": number,
    "score": number,
    "totalVotes": number,
    "positiveVotes": number
  }
]
```
- `400 Bad Request`: Invalid session ID format
```json
{
  "error": "Invalid session ID format"
}
```
- `404 Not Found`: Session not found
```json
{
  "error": "Session not found"
}
```
- `500 Internal Server Error`: Server error occurred
```json
{
  "error": "Internal server error"
}
```

## Data Models

### User
```json
{
  "_id": "string",
  "email": "string",
  "displayName": "string",
  "fcmToken": "string",
  "sessionHistory": ["string"]
}
```

### Session
```json
{
  "_id": "string",
  "creator": "string",
  "participants": [
    {
      "userId": "string",
      "preferences": [
        {
          "restaurantId": "string",
          "liked": boolean,
          "timestamp": "date"
        }
      ]
    }
  ],
  "pendingInvitations": ["string"],
  "status": "CREATED" | "ACTIVE" | "MATCHING" | "COMPLETED",
  "settings": {
    "location": {
      "latitude": number,
      "longitude": number,
      "radius": number
    }
  },
  "restaurants": [
    {
      "restaurantId": "string",
      "score": number,
      "totalVotes": number,
      "positiveVotes": number
    }
  ],
  "createdAt": "date",
  "expiresAt": "date"
}
```

## Notes

1. All requests must use JSON content type: `Content-Type: application/json`
2. Date fields are in ISO 8601 format
3. IDs are MongoDB ObjectIds represented as strings
4. Session expiry is handled automatically by the server
5. FCM tokens are used for push notifications when users are invited to sessions
