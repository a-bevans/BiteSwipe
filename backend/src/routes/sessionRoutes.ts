import { SessionController } from '../controllers/sessionController';
import { SessionManager } from '../services/sessionManager';
import { body, param } from 'express-validator'; 


export const sessionRoutes = (sessionManager: SessionManager) => {
    const sessionController = new SessionController(sessionManager);

    return [
        {
            method: 'post',
            route: '/sessions',
            action: sessionController.createSession,
            validation: [
                body('userId').notEmpty().withMessage('User ID is required'),
                body('latitude').isNumeric().withMessage('Latitude must be a number'),
                body('longitude').isNumeric().withMessage('Longitude must be a number'),
                body('radius').isNumeric().withMessage('Radius must be a number')
            ]
        },
        {
            method: 'post',
            route: '/sessions/:sessionId/join',
            action: sessionController.joinSession,
            validation: [
                param('sessionId').notEmpty().withMessage('Session ID is required'),
                body('userId').notEmpty().withMessage('User ID is required')
            ]
        }
    ];
};