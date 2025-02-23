import { Request, Response } from 'express';
import { UserService } from '../services/userService';

export class UserController {
    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    async createUser(req: Request, res: Response) {
        try {
            const { email, displayName } = req.body;
            const user = await this.userService.createUser(email, displayName);

            res.status(201).json({
                userId: user._id,
                email: user.email,
                displayName: user.displayName
            });
        } catch (error) {
            res.status(500).json({ error: error });
        }
    }
    
}