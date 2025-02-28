import mongoose, { Document, Types } from 'mongoose';

type SessionStatus = 'CREATED' | 'ACTIVE' | 'MATCHING' | 'COMPLETED';

interface IParticipant {
    userId: Types.ObjectId;
    preferences: {
        restaurantId: string;
        liked: boolean;
        timestamp: Date;
    }[];
}

interface ISession extends Document {
    creator: Types.ObjectId;
    participants: IParticipant[];
    pendingInvitations: Types.ObjectId[];
    status: SessionStatus;
    settings: {
        location: {
            latitude: number;
            longitude: number;
            radius: number;
        };
    };
    restaurants: Array<{
        restaurantId: Types.ObjectId;
        score: number;
        totalVotes: number;
        positiveVotes: number;
    }>;
    finalSelection?: {
        restaurantId: Types.ObjectId;
        selectedAt: Date;
    };
    createdAt: Date;
    expiresAt: Date;
}

const SessionSchema = new mongoose.Schema<ISession>({
    creator: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true 
    },
    participants: [{
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            required: true 
        },
        preferences: [{
            restaurantId: String,
            liked: Boolean,
            timestamp: Date
        }]
    }],
    pendingInvitations: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    status: {
        type: String,
        enum: ['CREATED', 'ACTIVE', 'MATCHING', 'COMPLETED'],
        default: 'CREATED'
    },
    settings: {
        location: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true },
            radius: { type: Number, required: true }
        }
    },
    restaurants: [{
        restaurantId: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Restaurant',
            required: true 
        },
        score: { type: Number, default: 0 },
        totalVotes: { type: Number, default: 0 },
        positiveVotes: { type: Number, default: 0 }
    }],
    finalSelection: {
        restaurantId: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Restaurant'
        },
        selectedAt: Date
    },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
});

export const Session = mongoose.model<ISession>('Session', SessionSchema);
export type { ISession, IParticipant, SessionStatus };