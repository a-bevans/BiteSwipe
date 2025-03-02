import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

let messaging: admin.messaging.Messaging | null = null;

try {
    // Path to the credentials file - should be in the backend directory
    const credentialsFile = 'biteswipe-132f1-firebase-adminsdk-fbsvc-76c5bb6fe5.json';
    const credentialsPath = path.join(__dirname, '..', '..', credentialsFile);

    // Check if credentials file exists
    if (fs.existsSync(credentialsPath)) {
        console.log(`Using Firebase credentials from file: ${credentialsPath}`);
        
        // Read the file as string and parse it to a JSON object
        const serviceAccountStr = fs.readFileSync(credentialsPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountStr);
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount as ServiceAccount)
            });
        }
        
        messaging = admin.messaging();
        console.log('Firebase initialized successfully');
    } else {
        console.warn(`WARNING: Firebase credentials file not found at ${credentialsPath}`);
        console.warn('Firebase notifications will not be available');
    }
} catch (error) {
    console.error('ERROR initializing Firebase:', error);
    console.warn('Firebase notifications will not be available');
}

// Export a mock messaging object if Firebase initialization failed
const getMessaging = () => {
    if (messaging) {
        return messaging;
    } else {
        console.log('Using mock Firebase messaging');
        return {
            send: async () => {
                console.log('Mock Firebase messaging: message would be sent here');
                return 'mock-message-id';
            },
            sendMulticast: async () => {
                console.log('Mock Firebase messaging: multicast message would be sent here');
                return { successCount: 0, failureCount: 0, responses: [] };
            }
        } as unknown as admin.messaging.Messaging;
    }
};

export { getMessaging };
export default admin;
