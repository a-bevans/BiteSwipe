import express, { Express } from 'express';
import morgan from 'morgan';
import { userRoutes } from './routes/userRoutes';
import { sessionRoutes } from './routes/sessionRoutes';
import { UserService } from './services/userService';
import { SessionManager } from './services/sessionManager';
import { RestaurantService } from './services/restaurantService';
import { validateRequest } from './middleware/validateRequest';

export async function createApp(): Promise<Express> {
  const app = express();

  // Use Morgan for request logging
  app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize services
  const restaurantService = new RestaurantService();
  const userService = new UserService();
  const sessionManager = new SessionManager(restaurantService);

  // Store build timestamp - this will be fixed at deployment time
  const buildTimestamp = new Date().toISOString();

  // Register routes
  const routes = [
    ...userRoutes(userService, sessionManager),
    ...sessionRoutes(sessionManager)
  ];

  // Register routes with validation
  routes.forEach(route => {
    const { method, route: path, action, validation } = route;
    console.log(`Registering route: ${method.toUpperCase()} ${path}`);
    app[method](path, validation, validateRequest, action);
  });

  // Add default route
  app.get('/', (req, res) => {
    res.status(200).json({ 
      message: 'Welcome to BiteSwipe API', 
      serverTime: new Date().toISOString(),
      buildTime: buildTimestamp,
      version: '1.0.0',
      status: 'online',
    });
  });

  // Add health check endpoint for Docker
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  return app;
}
