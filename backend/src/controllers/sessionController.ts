import { Request, Response } from "express";
import { SessionManager } from "../services/sessionManager";

import { mongo, Types } from "mongoose";


export class SessionController {
    private sessionManager: SessionManager;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.createSession = this.createSession.bind(this);
        this.joinSession = this.joinSession.bind(this);
    }

    async createSession(req, res: Response) {
        try {
            const settings  = {location: {latitude: req.body.latitude, longitude: req.body.longitude, radius: req.body.radius}};
            const session = await this.sessionManager.createSession(new Types.ObjectId(req.body.userId), settings);

            res.status(201).json({
                sessionId: session._id,
            });
        } catch (error) {

            console.log(error);

            res.status(500).json({ error: error });
        }
    }


    async joinSession(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;
            const session = await this.sessionManager.joinSession(new Types.ObjectId(sessionId), req.body.userId);
            
            res.json({ success: true, session: session._id });
        } catch (error) {
            console.log(error);

            res.status(500).json({ error: error });
        }
    }
}