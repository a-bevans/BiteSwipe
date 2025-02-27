import * as admin from 'firebase-admin';
import * as path from 'path';

// Get the service account file path from environment variable
const serviceAccountPath = path.join(__dirname, '../../', process.env.FIREBASE_JSON_FILENAME || 'firebase-service-account.json');

try {
    // Initialize Firebase Admin SDK
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error('Error initializing Firebase:', error);
    console.error('Make sure FIREBASE_JSON_FILENAME is set in .env and the file exists');
    process.exit(1);
}

export default admin;
