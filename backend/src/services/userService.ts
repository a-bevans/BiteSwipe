import { UserModel } from '../models/user';
import { Types } from 'mongoose';

interface Location {
    latitude: number,
    longitude: number,
    radius: number
}

interface Restaurant {
    id: String,
    name: String,
    location: Location,
    rating: Number
}

export class UserService {
    async createUser(email: string, displayName: string) {  
        const existingUser = await this.getUserByEmail(email);
        
        if (existingUser) {
            throw new Error('User already exists');
        }

        try {
            const user = new UserModel({
                email,
                displayName,
                sessionHistory: [],
                restaurantInteractions: []
            });

            return await user.save();
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async getUserById(userId: string | Types.ObjectId) {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                throw new Error('Invalid user ID format');
            }
            return await UserModel.findById(new Types.ObjectId(userId))
                .select('-__v') // Exclude version field
                .lean(); // Convert to plain JavaScript object
        } catch (error) {
            console.error('Error getting user:', error);
            throw error;
        }
    }

    async getUserByEmail(email: string) {
        try {
            return await UserModel.findOne({ email });
        } catch (error) {
            console.error('Error getting user by email:', error);
            throw error;
        }
    }

    async updateFCMToken(userId: string | Types.ObjectId, fcmToken: string) {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                throw new Error('Invalid user ID format');
            }
            const result = await UserModel.findByIdAndUpdate(new Types.ObjectId(userId), { fcmToken }, { new: true })
                .select('-__v')
                .lean();
            if (!result) {
                throw new Error('User not found');
            }
            return result;
        } catch (error) {
            console.error('Error updating FCM token:', error);
            throw error;
        }
    }
}