import { Session } from '../models/session';
import mongoose, { ObjectId } from 'mongoose';
import { Types } from 'mongoose';

export class SessionManager {
    async createSession(creatorId: Types.ObjectId, settings: any) {
        const session = new Session({
            creator: creatorId,
            settings: settings,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() +  20 * 60 * 1000) // we can make it dynamic later 
        });

        const restaurants = []//await this.fetch // API call to fetch restaurants
        session.restaurants = restaurants.map(r => ({
            restaurantId: r.id,
            score: 0,
            totalVotes: 0,
            positiveVotes: 0
        }));
    
        return await session.save();
    }

    async joinSession(sessionId: Types.ObjectId, userId: string) {
        const session = await Session.findById(sessionId);
        if (!session || session.status.valueOf() === 'COMPLETED') {
            throw new Error('Session not found or already completed');
        }

        if(!session.participants.find(p => p.userId.toString() === userId.toString())){
            session.participants.push({
                userId: new mongoose.Schema.Types.ObjectId(userId),
                preferences: []
            });
            await session.save();
        }
        // ELSe statement for logic
        return session;
    }

    // async handleSwipe(sessionId: string, userId: string, restaurantId: string, liked: boolean) {
    //     const session = await Session.findById(sessionId);
    //     if (!session || session.status.valueOf() === 'COMPLETED') {
    //         throw new Error('Session not found or already completed');
    //     }

    //     const participant = session.participants.find(p => p.userId.valueOf() === userId);
    //     if (!participant) {
    //         throw new Error('Participant not found');
    //     }

    //     const preference = participant.preferences.find(p => p.restaurantId === restaurantId);
    //     if (!preference) {
    //         participant.preferences.push({
    //             restaurantId: restaurantId,
    //             liked: liked,
    //             timestamp: new Date()
    //         });
    //     } else {
    //         preference.liked = liked;
    //         preference.timestamp = new Date();
    //     }

    //     await session.save();
    //     return session;
    // }
}