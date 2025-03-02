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

    async getUserById(userId: Types.ObjectId) {
        try {
            return await UserModel.findById(userId);
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
}