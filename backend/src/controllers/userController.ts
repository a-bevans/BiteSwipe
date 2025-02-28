import { Request, Response } from 'express';
import { UserModel } from '../models/user';
import { Types } from 'mongoose';
import { SessionManager } from '../services/sessionManager';
import { UserService } from '../services/userService';

export class UserController {
    private userService: UserService;
    private sessionManager: SessionManager;

    constructor(userService: UserService, sessionManager: SessionManager) {
        this.userService = userService;
        this.sessionManager = sessionManager;
        this.createUser = this.createUser.bind(this);
        this.updateFCMToken = this.updateFCMToken.bind(this);
        this.getUserSessions = this.getUserSessions.bind(this);
        this.getUser = this.getUser.bind(this);
    }

    async getUser(req: Request, res: Response) {
        try {
            const userId = req.params.userId;
            
            if (!Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            const user = await UserModel.findById(new Types.ObjectId(userId))
                .select('-__v') // Exclude version field
                .lean(); // Convert to plain JavaScript object
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createUser(req: Request, res: Response) {
        try {
            const user = new UserModel({
                email: req.body.email,
                displayName: req.body.displayName
            });
            await user.save();
            res.status(201).json(user);
        } catch (error) {
            console.error(error);
            res.status(400).json({ error: 'Unable to create user' });
        }
    }

    async updateFCMToken(req: Request, res: Response) {
        try {
            const userId = new Types.ObjectId(req.params.userId);
            const fcmToken = req.body.fcmToken;

            await UserModel.findByIdAndUpdate(userId, { fcmToken });
            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(400).json({ error: 'Unable to update FCM token' });
        }
    }

    async getUserSessions(req: Request, res: Response) {
        try {
            const userId = new Types.ObjectId(req.params.userId);
            const sessions = await this.sessionManager.getUserSessions(userId);
            res.json({ sessions });
        } catch (error) {
            console.log('Error fetching user sessions:', error);
            res.status(400).json({ error: 'Unable to fetch sessions' });
        }
    }
}