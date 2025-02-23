import mongoose from 'mongoose';

interface SessionHistoryEntry {
    sessionId: string;
    role: 'CREATOR' | 'PARTICIPANT';
    joinedAt: Date;
    status: 'ACTIVE' | 'COMPLETED' | 'LEFT';
}

interface RestaurantInteraction {
    restaurantId: string;
    action: 'LIKE' | 'DISLIKE';
    timestamp: Date;
    sessionId: string;
}

interface userSchema {
    email: string;
    displayName: string;
    sessionHistory: SessionHistoryEntry[];
    restaurantInteractions: RestaurantInteraction[];
}

const UserSchema = new mongoose.Schema<userSchema>({
    email: {
        type: String,
        required: true,
        unique: true
    },
    displayName: String,
    sessionHistory: [{
        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Session'
        },
        role: {
            type: String,
            enum: ['CREATOR', 'PARTICIPANT']
        },
        joinedAt: Date,
        status: {
            type: String,
            enum: ['ACTIVE', 'COMPLETED'],
        },
    }],
    restaurantInteractions: [{
        restaurantId: String,
        action: {
            type: String,
            enum: ['LIKE', 'DISLIKE']
        },
        timestamp: Date,
        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Session'
        },
    }],
});

export const User = mongoose.model<userSchema>('User', UserSchema);