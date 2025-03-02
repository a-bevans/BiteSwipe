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

    // ATOMIC 
    async joinSession(sessionId: Types.ObjectId, userId: string) {
        const session = await Session.findOne({
            _id: sessionId,
            status: { $ne: 'COMPLETED'}
        });

        if (!session) {
            throw new Error('Session not found or already Completed');
        }

        if ( session.creator.toString() === userId) {
            throw new Error('User is the creator of the session');
        }

        const userObjId = new mongoose.Types.ObjectId(userId);  

        const updatedSession = await Session.findOneAndUpdate(
            {
                _id: sessionId,
                status: { $ne: 'COMPLETED'},
                'participants.userId': { $ne: userObjId }
            },
            {
                $push: {
                    participants: {
                        userId: userObjId,
                        preferences: []
                    }
                }
            },
            { new: true, runValidators: true}
        );

        if (!updatedSession) {
            const existingSession = await Session.findOne({
                _id: sessionId,
                'participants.userId': userObjId
            });

            if(existingSession) {
                throw new Error('User already in session');
            } else {
                throw new Error('Session not found or already Completed');
            }
        }

        return updatedSession;
    }

    // TODO add routes
    async sessionSwiped(sessionId: Types.ObjectId, userId: string, restaurantId: string, swipe: boolean) {
        const userObjId = new mongoose.Types.ObjectId(userId);

        const session = await Session.findOneAndUpdate(
            {
                _id: sessionId,
                status: { $eq: 'MATCHING' },
                'participants.userId': userObjId,
                'participants': {
                    $not: {
                        $elemMatch: {
                            userId: userObjId,
                            'preferences.restaurantId': restaurantId
                        }
                    }
                }
            },
            {
                $push: {
                    'participants.$.preferences': {
                        restaurantId: restaurantId,
                        liked: swipe,
                        timestamp: new Date()
                    }
                }
            },
            { new: true, runValidators: true }
        );

        if (!session){
            const existingSession = await Session.findOne({
                _id: sessionId,
                'participants': {
                    $elemMatch : {
                        userId: userObjId,
                        'preferences.restaurantId': restaurantId
                    }
                }
            });

            if (existingSession) {
                throw new Error('User already swiped on this restaurant');
            } else {
                throw new Error('Session does not exist or already completed or user not in session');
            }
        }

        return session;
    }

    async getRestaurantsInSession(sessionId: Types.ObjectId, userId: string) {
        const userObjId = new mongoose.Types.ObjectId(userId)
        
        const session = await Session.findOne({
            _id: sessionId,
            $or: [
                { 'participants.userId': userObjId},
                { creator: userObjId }
            ]
        });

        if (!session) {
            throw new Error('Session not found or user is not in session');
        } else {
            const restaurantsIds = session.restaurants.map(r => r.restaurantId);
            return this.restaurantService.getRestaurants(restaurantsIds);
        }
    }

    async startSession(sessionId: Types.ObjectId, userId: string) {
        const userObjId = new mongoose.Types.ObjectId(userId);

        const session = await Session.findOneAndUpdate(
            {
                _id: sessionId,
                creator: userObjId,
                status: 'CREATED'
            },
            {
                status: 'MATCHING'
            },
            { new: true, runValidators: true }
        );

        if (!session) {
            throw new Error('Session does not exists or user is not the creator or session does not have created status');
        }

        //Schedule the session to be marked as completed after 10 minutes
        setTimeout(async () => {
            try {
                await Session.findByIdAndUpdate(
                    sessionId,
                    { status: 'COMPLETED' },
                    { runValidators: true }
                );
                console.log(`Session: ${sessionId} Completed !!`);
            } catch (error) {
                console.log(`Failed to complete session: ${sessionId}`);
            }
        }, 1 * 60 * 1000);

        return session;
    }

}