import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../app';
import { mockSessionManager, mockRestaurantService } from '../setup';

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface POST /sessions
describe('Mocked: POST /sessions', () => {
  // Mocked behavior: SessionManager.createSession throws error
  // Input: valid session data
  // Expected status code: 500
  // Expected behavior: returns error message
  // Expected output: { error: 'Internal Server Error' }
  test('Create Session - Service Error', async () => {
    const mockError = new Error('Service failure');
    mockSessionManager.createSession.mockRejectedValue(mockError);

    const sessionData = {
      userId: 'testUserId',
      latitude: 49.2827,
      longitude: -123.1207,
      radius: 1000
    };
    const response = await request(app)
      .post('/sessions')
      .send(sessionData);
    
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    // expect(mockSessionManager.createSession).toHaveBeenCalled();
  });
});

// // Interface GET /sessions/:sessionId/restaurants
// describe('Mocked: GET /sessions/:sessionId/restaurants', () => {
//   // Mocked behavior: RestaurantService fails to fetch restaurants
//   // Input: valid session ID
//   // Expected status code: 500
//   // Expected behavior: returns error message
//   // Expected output: { error: 'Failed to fetch restaurants' }
//   test('Get Restaurants - External API Error', async () => {
//     const mockError = new Error('API failure');
//     mockRestaurantService.getRestaurants.mockRejectedValue(mockError);
//     mockSessionManager.getSession.mockResolvedValue({
//       id: 'testSessionId',
//       location: {
//         latitude: 49.2827,
//         longitude: -123.1207,
//         radius: 1000
//       }
//     });

//     const sessionId = 'testSessionId';
//     const response = await request(app)
//       .get(`/sessions/${sessionId}/restaurants`);
    
//     expect(response.status).toBe(500);
//     expect(response.body).toEqual({ error: 'Failed to fetch restaurants' });
//     expect(mockRestaurantService.getRestaurants).toHaveBeenCalled();
//   });

//   // Mocked behavior: Session not found
//   // Input: invalid session ID
//   // Expected status code: 404
//   // Expected behavior: returns not found error
//   // Expected output: { error: 'Session not found' }
//   test('Get Restaurants - Session Not Found', async () => {
//     mockSessionManager.getSession.mockResolvedValue(null);

//     const sessionId = 'nonExistentSession';
//     const response = await request(app)
//       .get(`/sessions/${sessionId}/restaurants`);
    
//     expect(response.status).toBe(404);
//     expect(response.body).toEqual({ error: 'Session not found' });
//     expect(mockSessionManager.getSession).toHaveBeenCalled();
//   });
// });

// // Interface POST /sessions/:sessionId/votes
// describe('Mocked: POST /sessions/:sessionId/votes', () => {
//   // Mocked behavior: SessionManager.sessionSwiped throws error
//   // Input: valid vote data
//   // Expected status code: 500
//   // Expected behavior: returns error message
//   // Expected output: { error: 'Internal Server Error' }
//   test('Record Vote - Service Error', async () => {
//     const mockError = new Error('Service failure');
//     mockSessionManager.sessionSwiped.mockRejectedValue(mockError);
//     mockSessionManager.getSession.mockResolvedValue({
//       id: 'testSessionId',
//       participants: ['testUserId']
//     });

//     const sessionId = 'testSessionId';
//     const voteData = {
//       restaurantId: 'testRestaurantId',
//       liked: true,
//       userId: 'testUserId'
//     };
//     const response = await request(app)
//       .post(`/sessions/${sessionId}/votes`)
//       .send(voteData);
    
//     expect(response.status).toBe(500);
//     expect(response.body).toEqual({ error: 'Internal server error' });
//     expect(mockSessionManager.sessionSwiped).toHaveBeenCalled();
//   });
// });
