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
import { RestaurantService } from './services/restaurantService'; // Import RestaurantService


const app = express();
const port = process.env.PORT;

// Connect to MongoDB
const db = new Database(process.env.DB_URI || 'mongodb://localhost:27017', 'cpen321-app-db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// SessionManager

const restaurantService = new RestaurantService(); // Create RestaurantService before SessionManager
const userService = new UserService();
const port = process.env.PORT || 3000;
const dbUrl = process.env.DB_URI || 'mongodb://localhost:27017/biteswipe';


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log(`Server is running at http://localhost:${port}/api/ip`);
  console.log(`Server is running at http://localhost:${port}/api/server-time`);
  console.log(`Server is running at http://localhost:${port}/api/first-last-name`);
  console.log(`Server is running at http://localhost:${port}/health`);
});
