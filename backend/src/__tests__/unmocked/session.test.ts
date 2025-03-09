import { Express } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app';
import { SessionManager } from '../../services/sessionManager';
import { RestaurantService } from '../../services/restaurantService';
import { UserService } from '../../services/userService';

// Mock all the services
jest.mock('mongoose', () => {
  class ObjectId {
    private str: string;
    
    constructor(str: string) {
      this.str = str;
    }

    toString() {
      return this.str;
    }

    equals(other: unknown) {
      return other?.toString() === this.str;
    }

    static isValid(str: string) {
      return true;
    }
  }

  return {
    ...jest.requireActual('mongoose'),
    Types: {
      ObjectId
    }
  };
});

interface CustomError extends Error {
  code?: string;
}

jest.mock('../../services/sessionManager', () => {
  return {
    SessionManager: jest.fn().mockImplementation(() => ({
      getRestaurantsInSession: jest.fn().mockImplementation((sessionId) => {
        if (sessionId.toString() === 'testSessionId') {
          return Promise.resolve([
            {
              _id: 'rest1',
              name: 'Test Restaurant',
              rating: 4.5,
              location: {
                latitude: 49.2827,
                longitude: -123.1207
              }
            }
          ]);
        }
        const error = new Error('Session not found') as CustomError;
        error.code = 'SESSION_NOT_FOUND';
        return Promise.reject(error);
      })
    }))
  };
});

jest.mock('../../services/restaurantService', () => {
  return {
    RestaurantService: jest.fn().mockImplementation(() => ({
      getRestaurants: jest.fn().mockImplementation((ids) => {
        return Promise.resolve([
          {
            _id: 'rest1',
            name: 'Test Restaurant',
            rating: 4.5,
            location: {
              latitude: 49.2827,
              longitude: -123.1207
            }
          }
        ]);
      })
    }))
  };
});

jest.mock('../../services/userService', () => {
  return {
    UserService: jest.fn().mockImplementation(() => ({
      getUserByEmail: jest.fn().mockResolvedValue({
        _id: 'testUserId',
        email: 'test@example.com',
        displayName: 'Test User'
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

// Interface GET /sessions/:sessionId/restaurants
describe('Unmocked: GET /sessions/:sessionId/restaurants', () => {
  // Input: valid session ID
  // Expected status code: 200
  // Expected behavior: returns list of restaurants
  // Expected output: array of restaurant objects
  test.only('Get Restaurants in Session', async () => {
    const sessionId = 'testSessionId';
    const response = await request(app)
      .get(`/sessions/${sessionId}/restaurants`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    // Since we're using mocks, we know there will be exactly one restaurant
    expect(response.body.length).toBe(1);
    expect(response.body[0]).toHaveProperty('name', 'Test Restaurant');
    expect(response.body[0]).toHaveProperty('rating', 4.5);
    expect(response.body[0]).toHaveProperty('location');
    expect(response.body[0].location).toEqual({
      latitude: 49.2827,
      longitude: -123.1207
    });
  });
});
