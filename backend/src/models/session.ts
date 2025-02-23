import mongoose from 'mongoose';
import { ObjectId } from 'mongoose';

export interface sessionSchema {
    creator: ObjectId,
    participants: {
        userId: ObjectId,
        preferences: {
            restaurantId: string,
            liked: Boolean,
            timestamp: Date
        }[]
    }[],
    status: {
        type: String,
        enum: ['CREATED', 'ACTIVE', 'MATCHING', 'COMPLETED'],
        default: 'CREATED'
    },
    settings: {
        location: {
            latitude: Number,
            longitude: Number,
            radius: Number
        }
        // Possiblly add more stuff like cuisine, price range, etc.
    },
    restaurants: {
        restaurantId: string,
        score: Number,
        totalVotes: Number,
        positiveVotes: Number
    }[],
    finalSelection: {
        restaurantId: string,
        selectedAt: Date
    }
    createdAt: Date,
    expiresAt: Date
};

const SessionSchema = new mongoose.Schema<sessionSchema>({
    creator: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        require: true
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        preferences: [{
            restaurantId: String,
            liked: Boolean,
            timestamp: Date
        }]
    }],
    status: {
        type: String,
        enum: ['CREATED', 'ACTIVE', 'MATCHING', 'COMPLETED'],
        default: 'CREATED'
    },
    settings: {
        location: {
            latitude: Number,
            longitude: Number,
            radius: Number
        }
    },
    restaurants: [{
        restaurantId: String,
        score: Number,
        totalVotes: Number,
        positiveVotes: Number
    }],
    finalSelection: {
        restaurantId: String,
        selectedAt: Date
    },
    createdAt: Date,
    expiresAt: Date
});

export const Session = mongoose.model<sessionSchema>('Session', SessionSchema);