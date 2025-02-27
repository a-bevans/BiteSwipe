import { UserController } from "../controllers/userController";
import { UserService } from "../services/userService";
import { body, param } from "express-validator";

export const userRoutes = (userService: UserService) => {
    const userController = new UserController(userService);

    return [
        {
            method: 'post',
            route: '/users/',
            action: userController.createUser,
            validation: [
                body('email').isEmail().withMessage('Valid email is required'),
                body('displayName').isString().withMessage('Display name is required')
            ]
        },
        {
            method: 'post',
            route: '/users/:userId/fcm-token',
            action: userController.updateFcmToken,
            validation: [
                param('userId').notEmpty().withMessage('User ID is required'),
                body('fcmToken').notEmpty().isString().withMessage('FCM token is required')
            ]
        }
    ]
}