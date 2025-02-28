import { Request, Response } from "express";
import { SessionManager } from "../services/sessionManager";
import { mongo, Types } from "mongoose";
import { NotificationService } from "../services/notificationService";
import { UserModel } from "../models/user";

interface CustomError extends Error {
    code?: string;
}

export class SessionController {
    private sessionManager: SessionManager;
    private notificationService: NotificationService;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.notificationService = new NotificationService();
        this.createSession = this.createSession.bind(this);
        this.inviteParticipant = this.inviteParticipant.bind(this);
        this.getSession = this.getSession.bind(this);
    }

    async getSession(req: Request, res: Response) {
        try {
            const sessionId = req.params.sessionId;
            
            if (!Types.ObjectId.isValid(sessionId)) {
                return res.status(400).json({ error: 'Invalid session ID format' });
            }

            const session = await this.sessionManager.getSession(new Types.ObjectId(sessionId));
            res.json(session);
        } catch (error) {
            console.error('Error fetching session:', error);
            if (error instanceof Error && (error as CustomError).code === 'SESSION_NOT_FOUND') {
                return res.status(404).json({ error: 'Session not found' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createSession(req: Request, res: Response) {
        try {
            const settings = {location: {latitude: req.body.latitude, longitude: req.body.longitude, radius: req.body.radius}};
            const session = await this.sessionManager.createSession(new Types.ObjectId(req.body.userId), settings);

            res.status(201).json({
                sessionId: session._id,
            });
        } catch (error) {
            console.log('Controller error:', error);
            // Log the actual error for debugging but return a generic message
            res.status(400).json({ error: 'Unable to create session' });
        }
    }

    async inviteParticipant(req: Request, res: Response) {
        try {
            const sessionId = new Types.ObjectId(req.params.sessionId);
            const userId = new Types.ObjectId(req.body.userId);
            
            // Get the session creator's info
            const session = await this.sessionManager.inviteParticipant(sessionId, userId);
            const creator = await UserModel.findById(session.creator);
            
            // Send notification to the user being added
            if (creator) {
                await this.notificationService.sendSessionInvite(
                    session._id,
                    userId,
                    creator.displayName || 'Someone'
                );
            }
            
            res.json({ success: true, session: session._id });
        } catch (error) {
            console.log(error);
            res.status(400).json({ error: 'Unable to invite participant' });
        }
    }
}