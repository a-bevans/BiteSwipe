# BiteSwipe API Documentation

This document describes the API endpoints available in the BiteSwipe backend service.

## Base URL

```
http://localhost:3000
```

## API Endpoints

### Users

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
- `500 Internal Server Error`: Server error
```json
{
  "error": "Failed to create user"
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
- `400 Bad Request`: Invalid user ID
```json
{
  "error": "Invalid user ID"
}
```
- `404 Not Found`: User not found
```json
{
  "error": "User not found"
}
```
- `500 Internal Server Error`: Server error
```json
{
  "error": "Failed to update FCM token"
}
```

### Sessions

#### Create Session
Creates a new dining session.

```http
POST /sessions
```

**Request Body**
```json
{
  "userId": "string",
  "latitude": "number",
  "longitude": "number",
  "radius": "number"
}
```

**Response**
- `201 Created`: Session created successfully
```json
{
  "sessionId": "string"
}
```
- `500 Internal Server Error`: Server error
```json
{
  "error": "Error message"
}
```

#### Join Session
Joins an existing dining session.

```http
POST /sessions/{sessionId}/join
```

**Parameters**
- `sessionId`: Session ID (path parameter)

**Request Body**
```json
{
  "userId": "string"
}
```

**Response**
- `200 OK`: Successfully joined session
```json
{
  "success": true,
  "session": "string"
}
```
- `500 Internal Server Error`: Server error
```json
{
  "error": "Error message"
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
  "settings": {
    "location": {
      "latitude": "number",
      "longitude": "number",
      "radius": "number"
    }
  },
  "participants": ["string"],
  "createdAt": "date",
  "expiresAt": "date"
}
```

## Error Handling

All endpoints may return the following error responses:

- `400 Bad Request`: Invalid input data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses follow this format:
```json
{
  "error": "Error message"
}
```

## Notes

1. All requests must use JSON content type: `Content-Type: application/json`
2. Date fields are in ISO 8601 format
3. IDs are MongoDB ObjectIds represented as strings
4. Session expiry is handled automatically by the server
5. FCM tokens are used for push notifications when users join sessions
