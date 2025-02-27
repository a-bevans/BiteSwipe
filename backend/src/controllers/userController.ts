import { Request, Response } from "express";
import { UserService } from "../services/userService";
import { Types } from "mongoose";
import { UserModel } from "../models/user";

export class UserController {
    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
        this.createUser = this.createUser.bind(this);
        this.updateFcmToken = this.updateFcmToken.bind(this);
    }

    async createUser(req: Request, res: Response) {
        try {
            const { email, displayName } = req.body;
            const user = await this.userService.createUser(email, displayName);
            res.status(201).json(user);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to create user' });
        }
    }

    async updateFcmToken(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const { fcmToken } = req.body;

            if (!Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }

            const user = await UserModel.findByIdAndUpdate(
                userId,
                { fcmToken },
                { new: true }
            );

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update FCM token' });
        }
    }
}