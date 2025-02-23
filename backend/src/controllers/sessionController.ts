import { Request, Response } from "express";
import { SessionManager } from "../services/sessionManager";

export class SessionController {
    private sessionManager: SessionManager;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
    }

    async createSession(req, res: Response) {
        try {
            const settings  = {location: req.body};
            const session = await this.sessionManager.createSession(req.user.id, settings);

            res.status(201).json({
                sessionId: session._id,
            });
        } catch (error) {
            res.status(500).json({ error: error });
        }
    }

    async joinSession(req, res: Response) {
        try {
            const { sessionId } = req.params;
            const session = await this.sessionManager.joinSession(sessionId, req.user.id);
            
            res.json({ success: true, session: session._id });
        } catch (error) {
            res.status(500).json({ error: error });
        }
    }
}