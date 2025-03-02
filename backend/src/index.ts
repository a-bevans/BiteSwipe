import 'dotenv/config';
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

// ---------------------------------------------------------
// ENV
// ---------------------------------------------------------
const port = process.env.PORT;
if (!port) {
    throw new Error('Missing environment variable: PORT. Add PORT=<number> to .env');
}

const dbUrl = process.env.DB_URI;
if (!dbUrl) {
    throw new Error('Missing environment variable: DB_URI. Add DB_URI=<url> to .env');
}

// Define SSL certificate paths
const sslCertPath = process.env.SSL_CERT_PATH;
const sslKeyPath = process.env.SSL_KEY_PATH;
if (!sslCertPath || !sslKeyPath) {
    throw new Error('Missing environment variable: SSL_CERT_PATH or SSL_KEY_PATH. Add SSL_CERT_PATH=<path> and SSL_KEY_PATH=<path> to .env');
}

// Basic startup info
console.log('\n=== Server Configuration ===');
console.log(`HTTPS Port: ${port}`);
console.log(`SSL Cert Path: ${sslCertPath}`);
console.log(`SSL Key Path: ${sslKeyPath}`);
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
        console.log('============================\n');

        // Attempt to start HTTPS server if SSL certificates exist
        try {
            console.log(`Checking for SSL certificates:`);
            console.log(`- Certificate file exists: ${fs.existsSync(sslCertPath)}`);
            console.log(`- Key file exists: ${fs.existsSync(sslKeyPath)}`);
            
            if (fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
                console.log(`Loading certificates from:`);
                console.log(`- Cert: ${sslCertPath}`);
                console.log(`- Key: ${sslKeyPath}`);
                
                const httpsOptions = {
                    key: fs.readFileSync(sslKeyPath),
                    cert: fs.readFileSync(sslCertPath)
                };
                
                // Log certificate info
                try {
                    const keyData = fs.readFileSync(sslKeyPath, 'utf8');
                    const certData = fs.readFileSync(sslCertPath, 'utf8');
                    console.log(`Key file length: ${keyData.length} chars`);
                    console.log(`Cert file length: ${certData.length} chars`);
                    console.log(`Key file starts with: ${keyData.substring(0, 40)}...`);
                    console.log(`Cert file starts with: ${certData.substring(0, 40)}...`);
                } catch (e) {
                    console.error('Error reading certificate files for logging:', e);
                }
                
                const httpsServer = https.createServer(httpsOptions, app);
                httpsServer.listen(port, () => {
                    console.log(`HTTPS server is running on port ${port}`);
                });
            } else {
                // Exit with error if certificates are not found
                if (!fs.existsSync(sslCertPath)) {
                    console.error(`ERROR: SSL certificate file not found at absolute path: ${path.resolve(sslCertPath)}`);
                }
                if (!fs.existsSync(sslKeyPath)) {
                    console.error(`ERROR: SSL key file not found at absolute path: ${path.resolve(sslKeyPath)}`);
                }
                
                console.error('\n=== SSL Configuration Error ===');
                console.error('Server requires SSL certificates to operate.');
                console.error('Attempted to find certificates at:');
                console.error(`Certificate: ${path.resolve(sslCertPath)}`);
                console.error(`Key: ${path.resolve(sslKeyPath)}`);
                console.error('Set these environment variables to specify certificate locations:');
                console.error('  SSL_CERT_PATH - path to certificate file');
                console.error('  SSL_KEY_PATH - path to key file');
                console.error('===============================\n');
                
                process.exit(1); // Exit with error code
            }
        } catch (error) {
            console.error('Error starting HTTPS server:', error);
            console.error('\n=== SSL Configuration Error ===');
            console.error('Failed to start HTTPS server due to SSL configuration error.');
            console.error('Attempted to find certificates at:');
            console.error(`Certificate: ${path.resolve(sslCertPath)}`);
            console.error(`Key: ${path.resolve(sslKeyPath)}`);
            console.error('===============================\n');
            
            process.exit(1); // Exit with error code
        }
    })
    .catch(error => {
        console.error('\n=== MongoDB Connection Error ===');
        console.error('Failed to connect to MongoDB');
        console.error('Error:', error.message);
        console.error('=============================\n');
    });