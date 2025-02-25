import { Request, Response } from 'express';
import { UserService } from '../services/userService';

export class UserController {
    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
        this.createUser = this.createUser.bind(this);
    }

    async createUser(req: Request, res: Response) {
        try {
            const { email, displayName } = req.body;
            console.log(email, displayName);
            const user = await this.userService.createUser(email, displayName);
            console.log(user);

            res.status(201).json({
                userId: user._id,
                email: user.email,
                displayName: user.displayName
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error });
        }
    }
    
}