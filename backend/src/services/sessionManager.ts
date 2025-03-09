import mongoose, { Types } from 'mongoose';
import { Session, ISession, SessionStatus } from '../models/session';
import { RestaurantService } from './restaurantService';
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
        userId: string,
        settings: {
            latitude: number;
            longitude: number;
            radius: number;
        }
    ): Promise<ISession> {
        try {
            // Validate and convert userId to ObjectId
            if (!Types.ObjectId.isValid(userId)) {
                throw new Error('Invalid user ID format');
            }
            const userObjectId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;
            
            // Check if user exists
            const user = await UserModel.findById(userObjectId);
            if (!user) {
                const error = new Error() as CustomError;
                error.code = 'USER_NOT_FOUND';
                throw error;
            }

            // Set expiry to 24 hours from now
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            const restaurants = await this.restaurantService.addRestaurants(settings, '');

            const joinCode = await this.generateUniqueJoinCode();

            const session = new Session({
                creator: userObjectId,
                participants: [{
                    userId: userObjectId,
                    preferences: []
                }],
                pendingInvitations: [],
                settings: {
                    location: settings
                },
                restaurants: restaurants.map(r => {
                    return {
                        restaurantId: r._id,
                        score: 0,
                        totalVotes: 0,
                        positiveVotes: 0
                    };
                }),
                joinCode: joinCode,
                status: 'CREATED' as SessionStatus,
                expiresAt: expiresAt
            });

            session.doneSwiping = [userObjectId];

            await session.save();
            return session;
        } catch (error) {
            console.error('Session creation error:', error);
            throw error;
        }
    }

    private async generateUniqueJoinCode(): Promise<string> {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let isUnique = false;
        let joinCode = '';

        while (!isUnique) {
            joinCode = '';
            for (let i = 0; i < 5; i++) {
                joinCode += characters.charAt(Math.floor(Math.random() * characters.length));
            }

            const existingSession = await Session.findOne({ joinCode: joinCode, status: { $ne: 'COMPLETED'} });

            isUnique = !existingSession;
        }

        return joinCode
    }

    
    async sessionSwiped(sessionId: string, userId: string, restaurantId: string, swipe: boolean) {
        if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid ID format');
        }
        const sessionObjId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
        const userObjId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;

        const session = await Session.findOneAndUpdate(
            {
                _id: sessionObjId,
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
                _id: sessionObjId,
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

    async addPendingInvitation(sessionId: string, userId: string): Promise<ISession> {
        if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid ID format');
        }
        const sessionObjectId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
        const userObjectId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;

        const updatedSession = await Session.findOneAndUpdate(
            {
                _id: sessionObjectId,
                status: { $ne: 'COMPLETED' },
                'participants.userId': { $ne: userObjectId },
                pendingInvitations: { $ne: userObjectId }
            },
            {
                $push: { 
                    pendingInvitations: userObjectId,
                    doneSwiping: userObjectId
                }
            },
            { new: true, runValidators: true }
        );
    
        // Handle failure cases
        if (!updatedSession) {
            // Find the session to determine the specific error
            const session = await Session.findById(sessionObjectId);
            
            if (!session) {
                throw new Error('Session not found');
            } else if (session.status === 'COMPLETED') {
                throw new Error('Cannot invite users to a completed session');
            } else if (session.participants.some(p => p.userId.equals(userObjectId))) {
                throw new Error('User is already a participant');
            } else if (session.pendingInvitations.some(id => id.equals(userObjectId))) {
                throw new Error('User has already been invited');
            } else {
                throw new Error('Failed to invite user to session');
            }
        }
    
        return updatedSession;
    }

    async joinSession(joinCode: String, userId: string): Promise<ISession> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid user ID format');
        }
        const userObjectId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;

        const updatedSession = await Session.findOneAndUpdate(
            {
                joinCode: joinCode,
                status: { $ne: 'COMPLETED' },
                pendingInvitations: userObjectId,
                'participants.userId': { $ne: userObjectId }
            },
            {
                $pull: { pendingInvitations: userObjectId },
                $push: {
                    participants: {
                        userId: userObjectId,
                        preferences: []
                    }
                }
            },
            { new: true, runValidators: true }
        );
    
        if (!updatedSession) {
            // Determine the specific reason for failure
            const session = await Session.findOne({ joinCode: joinCode });
            
            if (!session) {
                throw new Error('Session not found');
            } else if (session.status === 'COMPLETED') {
                throw new Error('Cannot join a completed session');
            } else if (session.participants.some(p => p.userId.equals(userObjectId))) {
                throw new Error('User is already a participant');
            } else {
                throw new Error('User has not been invited to this session');
            }
        }
    
        return updatedSession;
    }

    async getUserSessions(userId: string): Promise<ISession[]> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                throw new Error('Invalid user ID format');
            }
            const userObjectId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;
            const sessions = await Session.find({
                $or: [
                    { creator: userObjectId },
                    { 'participants.userId': userObjectId },
                    { pendingInvitations: userObjectId }
                ],
                status: { $ne: 'COMPLETED' as SessionStatus }
            }).sort({ createdAt: -1 }); // Most recent first
            
            return sessions;
        } catch (error) {
            console.error('Error fetching user sessions:', error);
            throw error;
        }
    }

    async getSession(sessionId: string): Promise<ISession> {
        try {
            if (!Types.ObjectId.isValid(sessionId)) {
                throw new Error('Invalid session ID format');
            }
            const sessionObjId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
            
            const session = await Session.findById(sessionObjId);
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

    async rejectInvitation(sessionId: string, userId: string): Promise<ISession> {
        if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid ID format');
        }
        const sessionObjectId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
        const userObjectId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;

        const updatedSession = await Session.findOneAndUpdate(
            {
                _id: sessionObjectId,
                status: { $ne: 'COMPLETED' },
                pendingInvitations: userObjectId,
                'participants.userId': { $ne: userObjectId }
            },
            {
                $pull: { pendingInvitations: userObjectId }
            },
            { new: true, runValidators: true }
        );
    
        // Handle failure cases
        if (!updatedSession) {
            // Find the session to determine the specific error
            const session = await Session.findById(sessionObjectId);
            
            if (!session) {
                throw new Error('Session not found');
            } else if (session.status === 'COMPLETED') {
                throw new Error('Cannot reject invitation for a completed session');
            } else if (session.participants.some(p => p.userId.equals(userObjectId))) {
                throw new Error('User is already a participant');
            } else {
                throw new Error('User has not been invited to this session');
            }
        }
    
        return updatedSession;
    }

    async leaveSession(sessionId: string, userId: string): Promise<ISession> {
        if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid ID format');
        }
        const sessionObjectId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
        const userObjectId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;

        // Use findOneAndUpdate to perform an atomic operation
        const updatedSession = await Session.findOneAndUpdate(
            {
                _id: sessionObjectId,
                status: { $ne: 'COMPLETED' },
                creator: { $ne: userObjectId },
                'participants.userId': userObjectId
            },
            {
                $pull: { participants: { userId: userObjectId } }
            },
            { new: true, runValidators: true }
        );
    
        // Handle failure cases
        if (!updatedSession) {
            // Find the session to determine the specific error
            const session = await Session.findById(sessionObjectId);
            
            if (!session) {
                throw new Error('Session not found');
            } else if (session.status === 'COMPLETED') {
                throw new Error('Cannot leave a completed session');
            } else if (session.creator.equals(userObjectId)) {
                throw new Error('Session creator cannot leave the session');
            } else {
                throw new Error('User is not a participant in this session');
            }
        }
    
        return updatedSession;
    }

    async getRestaurantsInSession(sessionId: string) {
        try {
            if (!Types.ObjectId.isValid(sessionId)) {
                throw new Error('Invalid session ID format');
            }
            const sessionObjId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
            
            const session = await Session.findOne({
                _id: sessionObjId
            });

            if (!session) {
                const error = new Error('Session not found') as CustomError;
                error.code = 'SESSION_NOT_FOUND';
                throw error;
            }

            const restaurantsIds = session.restaurants.map(r => r.restaurantId);
            return await this.restaurantService.getRestaurants(restaurantsIds);
        } catch (error) {
            console.error('Error getting restaurants in session:', error);
            throw error;
        }
    }

    async startSession(sessionId: string, userId: string, time: number) {
        if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid ID format');
        }
        const sessionObjId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
        const userObjId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;

        const session = await Session.findOneAndUpdate(
            {
                _id: sessionObjId,
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
        }, (time || 5) * 60 * 1000);

        return session;
    }

    async userDoneSwiping(sessionId: string, userId: string) {
        if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid ID format');
        }
        const sessionObjId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
        const userObjId = new Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;

        const session = await Session.findOneAndUpdate(
            {
                _id: sessionObjId,
                status: 'MATCHING',
                'participants.userId': userObjId,
            },
            {
                $pull: { doneSwiping: userObjId }
            },
            { new: true, runValidators: true }
        );

        if (!session) {
            throw new Error('Session does not exists or user is not in session or user has already swiped');
        }

        if (session.doneSwiping.length === 0) {
            session.status = 'COMPLETED';
            await session.save();
        }

        return session;
    }

    async getResultForSession(sessionId: string) {
        if (!Types.ObjectId.isValid(sessionId)) {
            throw new Error('Invalid session ID format');
        }
        const sessionObjId = new Types.ObjectId(sessionId) as unknown as mongoose.Types.ObjectId;
        
        const session = await Session.findById(sessionObjId);
        if (!session) {
            throw new Error('Session not found');
        }

        // Only allow completed sessions or matching sessions where everyone is done swiping
        if (session.status !== 'COMPLETED' && 
            (session.status === 'MATCHING' && session.doneSwiping?.length !== 0)) {
            throw new Error('Session is not completed');
        }

        if(session.status === 'MATCHING') {
            // Mark the session as completed
            session.status = 'COMPLETED';
            await session.save();
        }

        const participants = session.participants;
        
        const restaurantVotes = new Map<string, number>();

        for (const restaurant of session.restaurants) {
            restaurantVotes.set(restaurant.restaurantId.toString(), 0);
        }

        for (const participant of participants) {
            for (const preference of participant.preferences) {
                if (preference.liked) {
                    const restaurantId = preference.restaurantId.toString();

                    const currentCount = restaurantVotes.get(restaurantId) || 0;
                    restaurantVotes.set(restaurantId, currentCount + 1);
                }
            }
        }
        
        for (const restaurant of session.restaurants) {
            const votes = restaurantVotes.get(restaurant.restaurantId.toString()) || 0;
            restaurant.positiveVotes = votes;
            restaurant.totalVotes = participants.length;
            restaurant.score = votes / participants.length;
        }


        const winnerRestaurant = [...restaurantVotes.entries()].reduce((a, e) => e[1] > a[1] ? e : a, ['', 0]);
        const winnerRestaurantId = winnerRestaurant[0];

        session.finalSelection = {
            restaurantId: new mongoose.Types.ObjectId(winnerRestaurantId),
            selectedAt: new Date
        };

        await session.save();

        return this.restaurantService.getRestaurant(new mongoose.Types.ObjectId(winnerRestaurantId));
    }

}
