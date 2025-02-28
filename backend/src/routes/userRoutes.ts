import { UserController } from '../controllers/userController';
import { body, param } from 'express-validator';
import { SessionManager } from '../services/sessionManager';
import { UserService } from '../services/userService';

export const userRoutes = (userService: UserService, sessionManager: SessionManager) => {
    const userController = new UserController(userService, sessionManager);

    return [
        {
            method: 'get',
            route: '/users/:userId',
            action: userController.getUser,
            validation: [
                param('userId').notEmpty().withMessage('User ID is required')
            ]
        },
        {
            method: 'post',
            route: '/users',
            action: userController.createUser,
            validation: [
                body('email').isEmail().withMessage('Valid email is required'),
                body('displayName').notEmpty().withMessage('Display name is required')
            ]
        },
        {
            method: 'post',
            route: '/users/:userId/fcm-token',
            action: userController.updateFCMToken,
            validation: [
                param('userId').notEmpty().withMessage('User ID is required'),
                body('fcmToken').notEmpty().withMessage('FCM token is required')
            ]
        },
        {
            method: 'get',
            route: '/users/:userId/sessions',
            action: userController.getUserSessions,
            validation: [
                param('userId').notEmpty().withMessage('User ID is required')
            ]
        }
    ];
};