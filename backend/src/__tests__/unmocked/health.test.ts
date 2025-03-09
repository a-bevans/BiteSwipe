import { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../app';

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

// Interface GET /health
describe('Unmocked: GET /health', () => {
  // Input: none
  // Expected status code: 200
  // Expected behavior: returns healthy status
  // Expected output: { status: 'healthy' }
  test('Health Check', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'healthy' });
  });
});
