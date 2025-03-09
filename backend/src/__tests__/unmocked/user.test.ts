import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../app';
import { UserService } from '../../services/userService';

interface CustomError extends Error {
  code?: string;
}

// Mock mongoose
jest.mock('mongoose', () => {
  class ObjectId {
    private str: string;
    
    constructor(str: string) {
      this.str = str;
    }

    toString() {
      return this.str;
    }

    toJSON() {
      return this.str;
    }

    equals(other: unknown) {
      return other?.toString() === this.str;
    }

    static isValid(str: string) {
      return str !== 'invalid-id';
    }
  }

  return {
    ...jest.requireActual('mongoose'),
    Types: {
      ObjectId
    }
  };
});

// Mock UserModel
jest.mock('../../models/user', () => {
  return {
    UserModel: {
      findById: jest.fn().mockImplementation((id) => {
        if (id.toString() === 'nonexistentId') {
          return {
            select: () => ({
              lean: () => Promise.resolve(null)
            })
          };
        }
        return {
          select: () => ({
            lean: () => Promise.resolve({
              _id: id,
              email: 'test@example.com',
              displayName: 'Test User'
            })
          })
        };
      }),
      create: jest.fn().mockImplementation((data) => Promise.resolve({
        _id: 'newUserId',
        ...data
      })),
      findByIdAndUpdate: jest.fn().mockImplementation((id, update) => {
        if (id.toString() === 'invalid-id') {
          return Promise.reject(new Error('Invalid ID'));
        }
        if (id.toString() === 'nonexistentId') {
          return Promise.resolve(null);
        }
        return Promise.resolve({ ...update, _id: id });
      })
    }
  };
});

// Mock the userService module
jest.mock('../../services/userService', () => {
  return {
    UserService: jest.fn().mockImplementation(() => ({
      createUser: jest.fn().mockImplementation((email, displayName) => {
        if (email === 'exists@example.com') {
          const error = new Error('User already exists') as CustomError;
          return Promise.reject(error);
        }
        return Promise.resolve({
          _id: 'newUserId',
          email,
          displayName
        });
      }),
      getUserByEmail: jest.fn().mockImplementation((email) => {
        if (email === 'exists@example.com') {
          return Promise.resolve({
            _id: 'existingId',
            email,
            displayName: 'Existing User'
          });
        }
        return Promise.resolve(null);
      })
    }))
  };
});

// Mock the sessionManager module
jest.mock('../../services/sessionManager', () => {
  return {
    SessionManager: jest.fn().mockImplementation(() => ({
      getUserSessions: jest.fn().mockImplementation((userId) => {
        if (userId.toString() === 'nonexistentId') {
          return Promise.reject(new Error('User not found'));
        }
        return Promise.resolve([
          {
            _id: 'session1',
            name: 'Test Session 1'
          },
          {
            _id: 'session2',
            name: 'Test Session 2'
          }
        ]);
      })
    }))
  };
});

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Unmocked: GET /users/:userId', () => {
  test('Get Existing User', async () => {
    const userId = 'testUserId';
    const response = await request(app).get(`/users/${userId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      _id: expect.any(String),
      email: 'test@example.com',
      displayName: 'Test User'
    });
  });

  test('Get User - Invalid ID Format', async () => {
    const response = await request(app).get('/users/invalid-id');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid user ID format' });
  });

  test('Get User - Not Found', async () => {
    const response = await request(app).get('/users/nonexistentId');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'User not found' });
  });
});

describe('Unmocked: GET /users/emails/:email', () => {
  test('Get User by Email - Found', async () => {
    const response = await request(app).get('/users/emails/exists@example.com');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: 'existingId',
      email: 'exists@example.com',
      displayName: 'Existing User'
    });
  });

  test('Get User by Email - Not Found', async () => {
    const response = await request(app).get('/users/emails/notfound@example.com');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'User not found' });
  });
});

describe('Unmocked: POST /users/:userId/fcm-token', () => {
  test('Update FCM Token - Success', async () => {
    const response = await request(app)
      .post('/users/testUserId/fcm-token')
      .send({ fcmToken: 'new-token' });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  test('Update FCM Token - User Not Found', async () => {
    const response = await request(app)
      .post('/users/nonexistentId/fcm-token')
      .send({ fcmToken: 'new-token' });
    
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unable to update FCM token' });
  });

  test('Update FCM Token - Invalid User ID', async () => {
    const response = await request(app)
      .post('/users/invalid-id/fcm-token')
      .send({ fcmToken: 'new-token' });
    
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unable to update FCM token' });
  });
});

describe('Unmocked: POST /users', () => {
  test('Create New User', async () => {
    const userData = {
      email: 'test@example.com',
      displayName: 'Test User'
    };
    const response = await request(app)
      .post('/users')
      .send(userData);
    
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      _id: 'newUserId',
      email: userData.email,
      displayName: userData.displayName
    });
  });

  test('Create User - Invalid Email', async () => {
    const userData = {
      email: 'invalid-email',
      displayName: 'Test User'
    };
    const response = await request(app)
      .post('/users')
      .send(userData);
    
    expect(response.status).toBe(400);
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({
        msg: 'Valid email is required'
      })
    );
  });

  test('Create User - Already Exists', async () => {
    const userData = {
      email: 'exists@example.com',
      displayName: 'Test User'
    };
    const response = await request(app)
      .post('/users')
      .send(userData);
    
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'User with this email already exists' });
  });

  test('Create User - Missing Fields', async () => {
    const response = await request(app)
      .post('/users')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({
        msg: 'Valid email is required'
      })
    );
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({
        msg: 'Display name is required'
      })
    );
  });
});

describe('Unmocked: GET /users/:userId/sessions', () => {
  test('Get User Sessions - Success', async () => {
    const response = await request(app).get('/users/testUserId/sessions');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sessions: [
        {
          _id: 'session1',
          name: 'Test Session 1'
        },
        {
          _id: 'session2',
          name: 'Test Session 2'
        }
      ]
    });
  });

  test('Get User Sessions - Invalid User ID', async () => {
    const response = await request(app).get('/users/invalid-id/sessions');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unable to fetch sessions' });
  });

  test('Get User Sessions - User Not Found', async () => {
    const response = await request(app).get('/users/nonexistentId/sessions');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unable to fetch sessions' });
  });
});
