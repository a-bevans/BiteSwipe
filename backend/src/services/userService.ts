import { User } from '../models/user';

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
        const user = new User({
            email: email,
            displayName: displayName,
            sessionHistory: [],
            restaurantInteractions: []
        });

        return await user.save();
    }

    async getUserByEmail(email: string) {
        return await User.findOne({email: email});
    }
}