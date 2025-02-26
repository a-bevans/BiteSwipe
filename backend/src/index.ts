import e from 'express';
import express from 'express';
import os from 'os';
import mongoose from 'mongoose'; // Import mongoose
import { Database} from './config/database';
import { sessionRoutes } from './routes/sessionRoutes';
import { userRoutes } from './routes/userRoutes';
import { SessionManager } from './services/sessionManager';
import { validationResult } from 'express-validator'; 
import { Request, Response, NextFunction } from 'express';
import { UserService } from './services/userService';


const app = express();
const port = process.env.PORT;

// Connect to MongoDB
const db = new Database(process.env.DB_URI || 'mongodb://localhost:27017', 'cpen321-app-db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// SessionManager

const sessionManager = new SessionManager();
const userSerivce = new UserService();

// Sessoin Routes

sessionRoutes(sessionManager).forEach((route) => {
  (app as any)[route.method](
    route.route,
    route.validation,
    async (req: Request, res: Response) => {
      console.log(`Route: ${route.route}  ${route.method}`);
      const errors = validationResult(req);
      if(!errors.isEmpty()){
        return res.status(400).json({ errors: errors.array() });
      } else {
        try {
          await route.action(req, res);
        } catch (error) {
          console.log(error + 'line 38');
          res.sendStatus(500);
        }
      }
    }
  )
});


// User Routes

userRoutes(userSerivce).forEach((route) => {
  (app as any)[route.method](
    route.route,
    route.validation,
    async (req: Request, res: Response) => {
      console.log(`Route: ${route.route}  ${route.method}`);
      const errors = validationResult(req);
      if(!errors.isEmpty()){
        return res.status(400).json({ errors: errors.array() });
      } else {
        try {
          await route.action(req, res);
        } catch (error) {
          console.log(error + 'line 80');
          res.sendStatus(500);
        }
      }
    }
  )
});


// Health check endpoint for Docker
app.get('/health', (req, res) => {
  // Check MongoDB connection
  if (mongoose.connection.readyState === 1) {
    res.status(200).json({ 
      status: 'healthy',
      database: 'connected',
      container: {
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    });
  } else {
    res.status(503).json({ 
      status: 'unhealthy',
      database: 'disconnected'
    });
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!+');
});

app.get('/api/server-time', (req, res) => {
  // Force timezone to Pacific Time
  process.env.TZ = 'America/Los_Angeles';
  
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  
  // Pacific Time is UTC-8 (or UTC-7 during DST)
  // Get the timezone offset in minutes and convert to hours:minutes
  const offsetInMinutes = -now.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetInMinutes) / 60);
  const offsetMinutes = Math.abs(offsetInMinutes) % 60;
  const offsetSign = offsetInMinutes >= 0 ? '+' : '-';
  const offsetFormatted = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;

  const formattedTime = `${hours}:${minutes}:${seconds} GMT${offsetFormatted}`;
  console.log(`${formattedTime}`);
  res.send(formattedTime);
});

app.get('/api/first-last-name', (req, res) => {
  res.send('Abdul Mohamed');
});


// Copilot generated code
//
// ? Question
// ? which one to report as the host IP?
// ? this code report the last one only
app.get('/api/ip', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  let hostIp = 'Not found';

  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];
    if (networkInterface) {
      for (const alias of networkInterface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          hostIp = alias.address;
            console.log(`Host IP found: ${hostIp}`);
          break;
        }
      }
    }
    else {
      console.log('No network interface found');
    }
  }

  // res.send(hostIp);
  res.send('52.13.165.167');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log(`Server is running at http://localhost:${port}/api/ip`);
  console.log(`Server is running at http://localhost:${port}/api/server-time`);
  console.log(`Server is running at http://localhost:${port}/api/first-last-name`);
  console.log(`Server is running at http://localhost:${port}/health`);
});
