import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { userRoutes } from './routes/userRoutes';
import { sessionRoutes } from './routes/sessionRoutes';
import { UserService } from './services/userService';
import { SessionManager } from './services/sessionManager';
import { RestaurantService } from './services/restaurantService';
import { validateRequest } from './middleware/validateRequest';

// Configure mongoose
mongoose.set('strictQuery', true);

const app = express();

// Use Morgan for request logging
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize services
const restaurantService = new RestaurantService();
const userService = new UserService();
const sessionManager = new SessionManager(restaurantService);

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

const port = process.env.PORT || 3000;
const dbUrl = process.env.DB_URI || 'mongodb://localhost:27017/biteswipe';

// Basic startup info
console.log('\n=== Server Configuration ===');
console.log(`Port: ${port}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('=========================\n');

// Configure mongoose connection with all recommended options
mongoose.connect(dbUrl, {
    autoIndex: true, // Build indexes
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4 // Use IPv4, skip trying IPv6
})
    .then(() => {
        console.log('\n=== MongoDB Connection Info ===');
        console.log('Connection Status: Connected');
        console.log(`Full URL: \x1b[34m${dbUrl}\x1b[0m`);
        console.log(`Database: ${mongoose.connection.name}`);
        console.log(`Host: ${mongoose.connection.host}`);
        console.log(`Port: ${mongoose.connection.port}`);
        console.log(`Clickable URL: \x1b[34mhttp://${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}\x1b[0m`);
        console.log('============================\n');

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch(error => {
        console.error('\n=== MongoDB Connection Error ===');
        console.error('Failed to connect to MongoDB');
        console.error('Error:', error.message);
        console.error('=============================\n');
    });