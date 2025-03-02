import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { SessionManager } from '../services/sessionManager';
import { NotificationService } from '../services/notificationService';
import { UserModel } from '../models/user';

export class SessionController {
    private sessionManager: SessionManager;
    private notificationService: NotificationService;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.notificationService = new NotificationService();

        // Bind methods
        this.getSession = this.getSession.bind(this);
        this.createSession = this.createSession.bind(this);
        this.inviteUser = this.inviteUser.bind(this);
        this.joinSession = this.joinSession.bind(this);

        this.getRestaurantsInSession = this.getRestaurantsInSession.bind(this);
        this.sessionSwiped = this.sessionSwiped.bind(this);
        this.startSession = this.startSession.bind(this);

        this.rejectInvitation = this.rejectInvitation.bind(this);
        this.leaveSession = this.leaveSession.bind(this);

    }

    async getSession(req: Request, res: Response) {
        try {
            const sessionId = req.params.sessionId;
            console.log('Session ID from params:', sessionId);
            
            if (!Types.ObjectId.isValid(sessionId)) {
                return res.status(400).json({ error: 'Invalid session ID format' });
            }

            const session = await this.sessionManager.getSession(new Types.ObjectId(sessionId));
            res.json(session);
        } catch (error) {
            console.error('Error fetching session:', error);
            if (error instanceof Error && (error as any).code === 'SESSION_NOT_FOUND') {
                return res.status(404).json({ error: 'Session not found' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createSession(req: Request, res: Response) {
        try {
            const { userId, latitude, longitude, radius } = req.body;

            if (!Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            const session = await this.sessionManager.createSession(
                new Types.ObjectId(userId),
                {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    radius: parseFloat(radius)
                }
            );

            res.status(201).json(session);
        } catch (error) {
            console.error('Error creating session:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async inviteUser(req: Request, res: Response) {
        try {
            const sessionId = req.params.sessionId;
            const { userId } = req.body;

            if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid session or user ID format' });
            }

            const session = await this.sessionManager.addPendingInvitation(
                new Types.ObjectId(sessionId),
                new Types.ObjectId(userId)
            );

            // Send notification to invited user
            const user = await UserModel.findById(userId);
            if (user?.fcmToken) {
                await this.notificationService.sendNotification(
                    user.fcmToken,
                    'Session Invitation',
                    'You have been invited to join a BiteSwipe session!'
                );
            }

            res.json(session);
        } catch (error) {
            console.error('Error inviting user:', error);
            if (error instanceof Error) {
                if (error.message.includes('already')) {
                    return res.status(400).json({ error: error.message });
                }
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async joinSession(req: Request, res: Response) {
        try {
            const sessionId = req.params.sessionId;
            const { userId } = req.body;

            if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid session or user ID format' });
            }

            const session = await this.sessionManager.joinSession(
                new Types.ObjectId(sessionId),
                new Types.ObjectId(userId)
            );

            res.json(session);
        } catch (error) {
            console.error('Error joining session:', error);
            if (error instanceof Error) {
                if (error.message.includes('not been invited')) {
                    return res.status(403).json({ error: error.message });
                }
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async rejectInvitation(req: Request, res: Response) {
        try {
            const { sessionId, userId } = req.params;

            if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid session or user ID format' });
            }

            const session = await this.sessionManager.rejectInvitation(
                new Types.ObjectId(sessionId),
                new Types.ObjectId(userId)
            );

            res.json(session);
        } catch (error) {
            console.error('Error rejecting invitation:', error);
            if (error instanceof Error) {
                if (error.message.includes('not been invited')) {
                    return res.status(403).json({ error: error.message });
                }
                if (error.message.includes('Session not found')) {
                    return res.status(404).json({ error: error.message });
                }
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async leaveSession(req: Request, res: Response) {
        try {
            const { sessionId, userId } = req.params;

            if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid session or user ID format' });
            }

            const session = await this.sessionManager.leaveSession(
                new Types.ObjectId(sessionId),
                new Types.ObjectId(userId)
            );

            res.json(session);
        } catch (error) {
            console.error('Error leaving session:', error);
            if (error instanceof Error) {
                if (error.message.includes('not a participant')) {
                    return res.status(403).json({ error: error.message });
                }
                if (error.message.includes('Session not found')) {
                    return res.status(404).json({ error: error.message });
                }
                if (error.message.includes('creator cannot leave')) {
                    return res.status(400).json({ error: error.message });
                }
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getRestaurantsInSession(req, res: Response) {
        try {
            const { sessionId } = req.params;
            const restaurants = await this.sessionManager.getRestaurantsInSession(new Types.ObjectId(sessionId), req.body.userId);

            res.json({ success: true, restaurants });
        } catch (error) {
            console.log(error);

            res.status(500).json({ error: error });
        }
    }

    async sessionSwiped(req, res: Response) {
        try {
            const { sessionId } = req.params;
            const { userId, restaurantId, swipe} = req.body;

            const session = await this.sessionManager.sessionSwiped(new Types.ObjectId(sessionId), userId, restaurantId, swipe);

            res.json({ success: true, session: session._id });
        } catch (error) {
            console.log(error);

            res.status(500).json({ error: error }); 
        }
    }

    async startSession(req, res: Response) {
        try {
            const { sessionId } = req.params;
            const { userId } = req.body;

            const session = await this.sessionManager.startSession(new Types.ObjectId(sessionId), userId);

            res.json({ success: true, session: session._id });
        } catch (error) {
            console.log(error);

            res.status(500).json({ error: error });
        }
    }
}