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
                body('latitude').isNumeric(),
                body('longitude').isNumeric(),
                body('radius').isNumeric(),
            ]
        },
        {
            method: 'post',
            route: '/sessions/:sessionId/join',
            action: sessionController.joinSession,
            validation: [
                param('sessionId').notEmpty(),
                param('sessionId').notEmpty().withMessage('Session ID is required')
            ]
        },
        {
            method: 'get',
            route: '/sessions/:sessionId/restaurants',
            action: sessionController.getRestaurantsInSession,
            validation: [
                param('sessionId').notEmpty()
            ]
        },
        {
            method: 'post',
            route: '/sessions/:sessionId/votes',
            action: sessionController.sessionSwiped,
            validation: [
                param('sessionId').notEmpty(),
                body('restaurantId').notEmpty(),
                body('liked').isBoolean()
            ]
        },
        {
            method: 'post',
            route: '/sessions/:sessionId/start',
            action: sessionController.startSession,
            validation: [
                param('sessionId').notEmpty()
            ]
        }
    ];
};