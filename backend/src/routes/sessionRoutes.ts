import { SessionController } from '../controllers/sessionController';
import { SessionManager } from '../services/sessionManager';
import { body, param } from 'express-validator'; 

export const sessionRoutes = (sessionManager: SessionManager) => {
    const sessionController = new SessionController(sessionManager);

    return [
        {
            method: 'get',
            route: '/sessions/:sessionId',
            action: sessionController.getSession,
            validation: [
                param('sessionId').exists().withMessage('Session ID is required')
                    .notEmpty().withMessage('Session ID cannot be empty')
            ]
        },
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
            route: '/sessions/:sessionId/invitations',
            action: sessionController.inviteUser,
            validation: [
                param('sessionId').notEmpty().withMessage('Session ID is required'),
                body('userId').notEmpty().withMessage('User ID is required')
            ]
        },
        {
            method: 'delete',
            route: '/sessions/:sessionId/invitations/:userId',
            action: sessionController.rejectInvitation,
            validation: [
                param('sessionId').notEmpty().withMessage('Session ID is required'),
                param('userId').notEmpty().withMessage('User ID is required')
            ]
        },
        {
            method: 'delete',
            route: '/sessions/:sessionId/participants/:userId',
            action: sessionController.leaveSession,
            validation: [
                param('sessionId').notEmpty().withMessage('Session ID is required'),
                param('userId').notEmpty().withMessage('User ID is required')
            ]
        },
        {
            method: 'post',
            route: '/sessions/:sessionId/participants',
            action: sessionController.joinSession,
            validation: [
                param('sessionId').notEmpty().withMessage('Session ID is required'),
                body('userId').notEmpty().withMessage('User ID is required')
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
        },
        {
            method: 'get',
            route: '/sessions/:sessionId/result',
            action: sessionController.getResultForSession,
            validation: [
                param('sessionId').notEmpty()   
            ]
        }
    ];
};