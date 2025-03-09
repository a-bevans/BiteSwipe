import * as admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import * as fs from 'fs';

let messaging: admin.messaging.Messaging | null = null;

try {
    // Path to the credentials file - can be set via environment variable or use default
    const credentialsPathname = process.env.FIREBASE_CREDENTIALS_JSON_PATHNAME;
    if (!credentialsPathname) {
        throw new Error('Firebase credentials JSON pathname is required. Add FIREBASE_CREDENTIALS_JSON_PATHNAME=<pathname> to .env'); 
    }

    // Check if credentials file exists
    if (fs.existsSync(credentialsPathname)) {
        console.log(`Using Firebase credentials from file: ${credentialsPathname}`);
        
        // Read the file as string and parse it to a JSON object
        const serviceAccountStr = fs.readFileSync(credentialsPathname, 'utf8');
        
        // Debug info - show file size and first few chars
        console.log(`Firebase credentials file size: ${serviceAccountStr.length} bytes`);
        console.log(`Firebase credentials file starts with: ${serviceAccountStr.substring(0, 20)}...`);
        
        try {
            const serviceAccount = JSON.parse(serviceAccountStr);
            
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount as ServiceAccount)
                });
            }
            
            messaging = admin.messaging();
            console.log('Firebase initialized successfully');
        } catch (parseError) {
            console.error('ERROR parsing Firebase credentials JSON:', parseError);
            console.error('First 50 characters of file:', serviceAccountStr.substring(0, 50));
            console.error('This may indicate the file was corrupted during copying or deployment');
        }
    } else {
        console.warn(`WARNING: Firebase credentials file not found at ${credentialsPathname}`);
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
