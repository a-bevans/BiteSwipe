import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../app';

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

describe('Mocked: GET /', () => {
  let dateToISOStringSpy: jest.SpyInstance;
  const mockDate = '2025-03-06T20:56:28.000Z';

  beforeEach(() => {
    // Mock Date.toISOString() for consistent timestamps
    dateToISOStringSpy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);
  });

  afterEach(() => {
    dateToISOStringSpy.mockRestore();
  });

  test('Root endpoint returns correct structure', async () => {
    const response = await request(app).get('/');
    
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Welcome to BiteSwipe API',
      serverTime: expect.any(String),
      buildTime: expect.any(String),
      version: '1.0.0',
      status: 'online'
    });

    // Verify timestamps are in ISO format
    expect(() => new Date(response.body.serverTime)).not.toThrow();
    expect(() => new Date(response.body.buildTime)).not.toThrow();
  });

  test('Response headers are correct', async () => {
    const response = await request(app).get('/');
    
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  test('Build time remains constant between requests', async () => {
    // First request
    const firstResponse = await request(app).get('/');
    const firstBuildTime = firstResponse.body.buildTime;

    // Mock a different time for second request
    const laterDate = '2025-03-06T21:00:00.000Z';
    dateToISOStringSpy.mockReturnValue(laterDate);

    // Second request
    const secondResponse = await request(app).get('/');
    
    // Server time should update
    expect(secondResponse.body.serverTime).toBe(laterDate);
    // But build time should remain the same
    expect(secondResponse.body.buildTime).toBe(firstBuildTime);
  });
});


