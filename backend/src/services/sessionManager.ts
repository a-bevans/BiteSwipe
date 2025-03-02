import { Types } from 'mongoose';
import { Session, ISession, SessionStatus } from '../models/session';
import { RestaurantService } from './restaurantService';
import mongoose, { ObjectId } from 'mongoose';
import { UserModel } from '../models/user';

interface CustomError extends Error {
    code?: string;
}

export class SessionManager {

    private restaurantService: RestaurantService;

    constructor(restaurantService: RestaurantService) {
        this.restaurantService = restaurantService;
    }
    
    async createSession(
        userId: Types.ObjectId,
        settings: {
            latitude: number;
            longitude: number;
            radius: number;
        }
    ): Promise<ISession> {
        try {
            // Check if user exists
            const user = await UserModel.findById(userId);
            if (!user) {
                const error = new Error() as CustomError;
                error.code = 'USER_NOT_FOUND';
                throw error;
            }

            // Set expiry to 24 hours from now
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            const restaurants = await this.restaurantService.addRestaurants(settings, '');

            const session = new Session({
                creator: userId,
                participants: [{
                    userId: userId,
                    preferences: []
                }],
                pendingInvitations: [],
                settings: {
                    location: settings
                },
                restaurants: restaurants.map(r => ({
                    restaurantId: r._id,
                    score: 0,
                    totalVotes: 0,
                    positiveVotes: 0
                })),
                status: 'CREATED' as SessionStatus,
                expiresAt: expiresAt
            });

            await session.save();
            return session;
        } catch (error) {
            console.error('Session creation error:', error);
            throw error;
        }
    }


    // // ATOMIC (EVANTAULLY HERE)
    // async joinSession(sessionId: Types.ObjectId, userId: string) {
    //     const session = await Session.findOne({
    //         _id: sessionId,
    //         status: { $ne: 'COMPLETED'}
    //     });

    //     if (!session) {
    //         throw new Error('Session not found or already Completed');
    //     }

    //     if ( session.creator.toString() === userId) {
    //         throw new Error('User is the creator of the session');
    //     }

    //     const userObjId = new mongoose.Types.ObjectId(userId);  

    //     const updatedSession = await Session.findOneAndUpdate(
    //         {
    //             _id: sessionId,
    //             status: { $ne: 'COMPLETED'},
    //             'participants.userId': { $ne: userObjId }
    //         },
    //         {
    //             $push: {
    //                 participants: {
    //                     userId: userObjId,
    //                     preferences: []
    //                 }
    //             },
    //             # TODOD
    //             $remove: {
    //                 participants: {
    //                     userId: userObjId,
    //                     pendingInvitations: []
    //                 }
    //             }
    //         },
    //         { new: true, runValidators: true}
    //     );

    //     if (!updatedSession) {
    //         const existingSession = await Session.findOne({
    //             _id: sessionId,
    //             'participants.userId': userObjId
    //         });

    //         if(existingSession) {
    //             throw new Error('User already in session');
    //         } else {
    //             throw new Error('Session not found or already Completed');
    //         }
    //     }

    //     return updatedSession;
    // }

    // TODO add routes
    async sessionSwiped(sessionId: Types.ObjectId, userId: string, restaurantId: string, swipe: boolean) {
        const userObjId = new mongoose.Types.ObjectId(userId);

        const session = await Session.findOneAndUpdate(
            {
                _id: sessionId,
                status: { $eq: 'MATCHING' },
                'participants.userId': userObjId,
                'participants': {
                    // TODO: BUG AFTER MVP; user should be able to revote in case of tie
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

    async addPendingInvitation(sessionId: Types.ObjectId, userId: Types.ObjectId): Promise<ISession> {
        const session = await Session.findById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        if (session.status === 'COMPLETED') {
            throw new Error('Cannot invite users to a completed session');
        }

        // Check if user is already a participant
        if (session.participants.some(p => p.userId.equals(userId))) {
            throw new Error('User is already a participant');
        }

        // Check if user is already invited
        if (session.pendingInvitations.some(id => id.equals(userId))) {
            throw new Error('User has already been invited');
        }

        session.pendingInvitations.push(userId);
        await session.save();
        return session;
    }

    async joinSession(sessionId: Types.ObjectId, userId: Types.ObjectId): Promise<ISession> {
        const session = await Session.findById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        if (session.status === 'COMPLETED') {
            throw new Error('Cannot join a completed session');
        }

        // Check if user is already a participant
        if (session.participants.some(p => p.userId.equals(userId))) {
            throw new Error('User is already a participant');
        }

        // Check if user has been invited
        const inviteIndex = session.pendingInvitations.findIndex(id => id.equals(userId));
        if (inviteIndex === -1) {
            throw new Error('User has not been invited to this session');
        }

        // Remove from pending invitations and add to participants
        session.pendingInvitations.splice(inviteIndex, 1);
        session.participants.push({
            userId: userId,
            preferences: []
        });

        await session.save();
        return session;
    }

    async getUserSessions(userId: Types.ObjectId): Promise<ISession[]> {
        try {
            const sessions = await Session.find({
                $or: [
                    { creator: userId },
                    { 'participants.userId': userId },
                    { pendingInvitations: userId }
                ],
                status: { $ne: 'COMPLETED' as SessionStatus }
            }).sort({ createdAt: -1 }); // Most recent first
            
            return sessions;
        } catch (error) {
            console.error('Error fetching user sessions:', error);
            throw error;
        }
    }

    async getSession(sessionId: Types.ObjectId): Promise<ISession> {
        try {
            const session = await Session.findById(sessionId);
            if (!session) {
                const error = new Error('Session not found') as Error & { code?: string };
                error.code = 'SESSION_NOT_FOUND';
                throw error;

            }
            return session;
        } catch (error) {
            console.error('Error fetching session:', error);
            throw error;
        }
    }

    async rejectInvitation(sessionId: Types.ObjectId, userId: Types.ObjectId): Promise<ISession> {
        const session = await Session.findById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        if (session.status === 'COMPLETED') {
            throw new Error('Cannot reject invitation for a completed session');
        }

        // Check if user is already a participant
        if (session.participants.some(p => p.userId.equals(userId))) {
            throw new Error('User is already a participant');
        }

        // Check if user was invited
        const inviteIndex = session.pendingInvitations.findIndex(id => id.equals(userId));
        if (inviteIndex === -1) {
            throw new Error('User has not been invited to this session');
        }

        // Remove from pending invitations
        session.pendingInvitations.splice(inviteIndex, 1);
        await session.save();
        return session;
    }

    async leaveSession(sessionId: Types.ObjectId, userId: Types.ObjectId): Promise<ISession> {
        const session = await Session.findById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        if (session.status === 'COMPLETED') {
            throw new Error('Cannot leave a completed session');
        }

        // Check if user is the creator
        if (session.creator.equals(userId)) {
            throw new Error('Session creator cannot leave the session');
        }

        // Check if user is a participant
        const participantIndex = session.participants.findIndex(p => p.userId.equals(userId));
        if (participantIndex === -1) {
            throw new Error('User is not a participant in this session');
        }


        // Remove from participants
        session.participants.splice(participantIndex, 1);
        await session.save();

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
