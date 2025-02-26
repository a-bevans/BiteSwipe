import { Session } from '../models/session';
import mongoose, { ObjectId } from 'mongoose';
import { Types } from 'mongoose';

import { RestaurantService } from './RestaurantService';

export class SessionManager {

    private restaurantService: RestaurantService;

    constructor() {
        this.restaurantService = new RestaurantService();
    }
    
    async createSession(creatorId: Types.ObjectId, settings: any) {
        try {
            const restaurants = await this.restaurantService.addRestaurants(settings.location,'');
        
            const session = new Session({
                creator: creatorId,
                settings: settings,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() +  20 * 60 * 1000), // we can make it dynamic later 
                restaurants: restaurants.map(r => ({
                    restaurantId: r._id,
                    score: 0,
                    totalVotes: 0,
                    positiveVotes: 0
                }))
            });

            return await session.save();
        } catch (error) {
            console.error(error);
            throw new Error('Failed to create session');
        }
    }

    async joinSession(sessionId: Types.ObjectId, userId: string) {
        const session = await Session.findById(sessionId);
        if (!session || session.status.valueOf() === 'COMPLETED') {
            throw new Error('Session not found or already completed');
        }


        if(session.participants.length === 0) {
            session.participants.push({
                userId: new mongoose.Types.ObjectId(userId),
                preferences: []
            })

            return await session.save();
        } else {
            if(!session.participants.find(p => p.userId.toString() === userId)){
                session.participants.push({
                    userId: new mongoose.Types.ObjectId(userId),
                    preferences: []
                });

                return await session.save();
            } else {
                throw new Error('User already in session'); 
            }
        }

    }
}