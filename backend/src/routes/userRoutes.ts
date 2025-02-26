import { UserController } from "../controllers/userController";
import { UserService } from "../services/userService";
import { body, param } from "express-validator";

export const userRoutes = (userService: UserService) => {
    const userController = new UserController(userService);

    return [
        {
            method: 'post',
            route: '/users/create',
            action: userController.createUser,
            validation: [
                body('email').isEmail(),
                body('displayName').isString()
            ]
        }
    ]
}