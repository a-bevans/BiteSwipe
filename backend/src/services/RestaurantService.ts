import { Restaurant, IRestaurant } from '../models/Restaurant';
import { FilterQuery } from 'mongoose';

export class RestaurantService {
    // Create a new restaurant
    static async create(data: Partial<IRestaurant>): Promise<IRestaurant> {
        try {
            const restaurant = new Restaurant(data);
            return await restaurant.save();
        } catch (error) {
            throw new Error(`Error creating restaurant: ${error}`);
        }
    }

    // Get all restaurants with optional filters
    static async findAll(filters: FilterQuery<IRestaurant> = {}): Promise<IRestaurant[]> {
        try {
            return await Restaurant.find(filters);
        } catch (error) {
            throw new Error(`Error fetching restaurants: ${error}`);
        }
    }

    // Get a single restaurant by ID
    static async findById(id: string): Promise<IRestaurant | null> {
        try {
            return await Restaurant.findById(id);
        } catch (error) {
            throw new Error(`Error fetching restaurant: ${error}`);
        }
    }

    // Update a restaurant
    static async update(id: string, data: Partial<IRestaurant>): Promise<IRestaurant | null> {
        try {
            return await Restaurant.findByIdAndUpdate(
                id,
                { $set: data },
                { new: true }
            );
        } catch (error) {
            throw new Error(`Error updating restaurant: ${error}`);
        }
    }

    // Delete a restaurant
    static async delete(id: string): Promise<IRestaurant | null> {
        try {
            return await Restaurant.findByIdAndDelete(id);
        } catch (error) {
            throw new Error(`Error deleting restaurant: ${error}`);
        }
    }

    // Custom queries
    static async findByPriceRange(priceRange: string): Promise<IRestaurant[]> {
        try {
            return await Restaurant.find({ priceRange });
        } catch (error) {
            throw new Error(`Error fetching restaurants by price range: ${error}`);
        }
    }

    static async findByCuisine(cuisine: string): Promise<IRestaurant[]> {
        try {
            return await Restaurant.find({ cuisine });
        } catch (error) {
            throw new Error(`Error fetching restaurants by cuisine: ${error}`);
        }
    }

    // Add menu item to a restaurant
    static async addMenuItem(
        restaurantId: string,
        menuItem: {
            name: string;
            price: number;
            description?: string;
            category: string;
        }
    ): Promise<IRestaurant | null> {
        try {
            return await Restaurant.findByIdAndUpdate(
                restaurantId,
                { $push: { menu: menuItem } },
                { new: true }
            );
        } catch (error) {
            throw new Error(`Error adding menu item: ${error}`);
        }
    }

    // Remove menu item from a restaurant
    static async removeMenuItem(
        restaurantId: string,
        menuItemId: string
    ): Promise<IRestaurant | null> {
        try {
            return await Restaurant.findByIdAndUpdate(
                restaurantId,
                { $pull: { menu: { _id: menuItemId } } },
                { new: true }
            );
        } catch (error) {
            throw new Error(`Error removing menu item: ${error}`);
        }
    }
}
