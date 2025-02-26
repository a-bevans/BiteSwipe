import mongoose from 'mongoose';

import { ObjectId, Types } from 'mongoose';


export interface sessionSchema {
    creator: ObjectId,
    participants: {
        userId: Types.ObjectId,

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
        restaurantId: Types.ObjectId,

        score: Number,
        totalVotes: Number,
        positiveVotes: Number
    }[],
    finalSelection: {

        restaurantId: Types.ObjectId,

        selectedAt: Date
    }
    createdAt: Date,
    expiresAt: Date
};

const SessionSchema = new mongoose.Schema<sessionSchema>({
    creator: { 
        type: mongoose.Types.ObjectId,
        ref: 'User',
        require: true
    },
    participants: [{
        userId: {

            type: mongoose.Types.ObjectId,

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

        restaurantId: { type: mongoose.Types.ObjectId, ref: 'Restaurant' },

        score: Number,
        totalVotes: Number,
        positiveVotes: Number
    }],
    finalSelection: {

        restaurantId: { type: mongoose.Types.ObjectId, ref: 'Restaurant' },

        selectedAt: Date
    },
    createdAt: Date,
    expiresAt: Date
});

export const Session = mongoose.model<sessionSchema>('Session', SessionSchema);