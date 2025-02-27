import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const serviceAccount = require('../../firebase-service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

export default admin;
