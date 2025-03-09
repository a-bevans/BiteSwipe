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

        this.getResultForSession = this.getResultForSession.bind(this);
        this.userDoneSwiping = this.userDoneSwiping.bind(this);

    }

    async getSession(req: Request, res: Response) {
        try {
            const sessionId = req.params.sessionId;
            console.log('Session ID from params:', sessionId);
            
            const session = await this.sessionManager.getSession(sessionId);
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
            const { userId, latitude, longitude, radius } = req.body as { 
                userId: string, 
                latitude: string | number, 
                longitude: string | number, 
                radius: string | number 
            };
            
            // Convert coordinates to numbers
            const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
            const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
            const rad = typeof radius === 'string' ? parseFloat(radius) : radius;

            // Validate userId is a valid ObjectId
            if (!Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            const session = await this.sessionManager.createSession(
                userId,
                {
                    latitude: lat,
                    longitude: lng,
                    radius: rad
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
            const { email } = req.body;

            const user = await UserModel.findOne({ email });
            
            if (!user) {
                return res.status(404).json({ error: 'No user found with this email'});
            }
            
            const session = await this.sessionManager.addPendingInvitation(
                sessionId,
                user._id.toString()
            );

            // Send notification to invited user
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
            const joinCode = req.params.joinCode;
            const { userId } = req.body;

            const session = await this.sessionManager.joinSession(
                joinCode,
                userId
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

            const session = await this.sessionManager.rejectInvitation(sessionId, userId);

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

            const session = await this.sessionManager.leaveSession(sessionId, userId);

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

    async getRestaurantsInSession(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;
            const restaurants = await this.sessionManager.getRestaurantsInSession(sessionId);
            res.json(restaurants);
        } catch (error) {
            console.error('Error fetching restaurants:', error);
            if (error instanceof Error && (error as any).code === 'SESSION_NOT_FOUND') {
                return res.status(404).json({ error: 'Session not found' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async sessionSwiped(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;
            const { userId, restaurantId, liked} = req.body;

            const session = await this.sessionManager.sessionSwiped(sessionId, userId, restaurantId, liked);

            res.json({ success: true, session: session._id });
        } catch (error) {
            console.log(error);

            res.status(500).json({ error: error }); 
        }
    }

    async startSession(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;
            const { userId, time } = req.body;

            const session = await this.sessionManager.startSession(sessionId, userId, Number(time));

            res.json({ success: true, session: session._id });
        } catch (error) {
            console.log(error);

            res.status(500).json({ error: error });
        }
    }

    async userDoneSwiping(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;
            const { userId } = req.body;

            const session = await this.sessionManager.userDoneSwiping(sessionId, userId);

            res.json({ success: true, session: session._id });
        } catch (error) {
            console.log(error);

            res.status(500).json({ error: error });
        }
    }

    async getResultForSession(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;

            const result = await this.sessionManager.getResultForSession(sessionId);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);

            res.status(500).json({ error: error });
        }
    }
}