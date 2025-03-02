import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import https from 'https';
import fs from 'fs';
import path from 'path';
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
        documentation: '/api/docs'
    });
});

// Add health check endpoint for Docker
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

const port = process.env.PORT || 3000;
const dbUrl = process.env.DB_URI || 'mongodb://localhost:27017/biteswipe';

// Define SSL certificate paths
const sslCertPath = process.env.SSL_CERT_PATH || path.join(__dirname, '..', '..', 'cert.pem');
const sslKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '..', '..', 'key.pem');

// Basic startup info
console.log('\n=== Server Configuration ===');
console.log(`HTTPS Port: ${port}`);
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

        // Start HTTPS server if SSL certificates exist
        try {
            if (fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
                const httpsOptions = {
                    key: fs.readFileSync(sslKeyPath),
                    cert: fs.readFileSync(sslCertPath)
                };
                
                const httpsServer = https.createServer(httpsOptions, app);
                httpsServer.listen(port, () => {
                    console.log(`HTTPS server is running on port ${port}`);
                });
            } else {
                console.log('SSL certificates not found. Falling back to HTTP server.');
                // Start HTTP server as fallback if no SSL certificates
                app.listen(port, () => {
                    console.log(`HTTP server is running on port ${port}`);
                });
            }
        } catch (error) {
            console.error('Error starting HTTPS server:', error);
            console.log('Falling back to HTTP server.');
            // Start HTTP server as fallback if HTTPS fails
            app.listen(port, () => {
                console.log(`HTTP server is running on port ${port}`);
            });
        }
    })
    .catch(error => {
        console.error('\n=== MongoDB Connection Error ===');
        console.error('Failed to connect to MongoDB');
        console.error('Error:', error.message);
        console.error('=============================\n');
    });