import { Restaurant } from '../models/Restaurant';
import { FilterQuery } from 'mongoose';
import { GooglePlacesService } from './externalAPIs/googleMaps';

export class RestaurantService {

    private googlePlacesService = new GooglePlacesService();
    
    async addRestaurants(location: { latitude: number, longitude: number, radius: number}, keyword?: string) {
        try {
            const places = await this.googlePlacesService.searchNearby(location.latitude, location.longitude, location.radius, keyword);

            const savedRestaurants = [];
            for (const place of places) {

                const restaurant_exist = await Restaurant.findOne({ 'sourceData.googlePlaceId': place.place_id });

                if(!restaurant_exist) {
                    const details = await this.googlePlacesService.getPlaceDetails(place.place_id);
                
                    const primaryImage = details.photos_url && details.photos_url.length > 0 ? details.photos_url[0] : '';
                    const galleryImages = details.photos_url && details.photos_url.length > 1 ? details.photos_url.slice(1) : [];

                    console.log('Creating new restaurant');

                    const RestaurantData = {
                        name: details.name,
                        location: {
                            address: details.formatted_address,
                            coordinates: {
                                latitude: details.geometry.location.lat,
                                longitude: details.geometry.location.lng
                            }
                        },
                        contact: {
                            phone: details.formatted_phone_number || ' ',
                            website: details.website || ' '
                        },
                        menu: {
                            categories: []
                        },
                        images: {
                            primary: primaryImage,
                            gallery: galleryImages
                        },
                        sourceData: {
                            googlePlaceId: place.place_id,
                            lastUpdated: new Date()
                        }
                    };

                    const restaurant = new Restaurant(RestaurantData);
                    savedRestaurants.push(await restaurant.save());
                } else {
                    console.log('Restaurant already exists');
                    savedRestaurants.push(restaurant_exist);
                }
            }
            
            return savedRestaurants;
        } catch (error) {
            console.error(error);
            throw new Error('Failed to create restaurants');
        }
    }

    // // Create a new restaurant
    // static async create(data: Partial<IRestaurant>): Promise<IRestaurant> {
    //     try {
    //         const restaurant = new Restaurant(data);
    //         return await restaurant.save();
    //     } catch (error) {
    //         throw new Error(`Error creating restaurant: ${error}`);
    //     }
    // }

    // // Get all restaurants with optional filters
    // static async findAll(filters: FilterQuery<IRestaurant> = {}): Promise<IRestaurant[]> {
    //     try {
    //         return await Restaurant.find(filters);
    //     } catch (error) {
    //         throw new Error(`Error fetching restaurants: ${error}`);
    //     }
    // }

    // // Get a single restaurant by ID
    // static async findById(id: string): Promise<IRestaurant | null> {
    //     try {
    //         return await Restaurant.findById(id);
    //     } catch (error) {
    //         throw new Error(`Error fetching restaurant: ${error}`);
    //     }
    // }

    // // Update a restaurant
    // static async update(id: string, data: Partial<IRestaurant>): Promise<IRestaurant | null> {
    //     try {
    //         return await Restaurant.findByIdAndUpdate(
    //             id,
    //             { $set: data },
    //             { new: true }
    //         );
    //     } catch (error) {
    //         throw new Error(`Error updating restaurant: ${error}`);
    //     }
    // }

    // // Delete a restaurant
    // static async delete(id: string): Promise<IRestaurant | null> {
    //     try {
    //         return await Restaurant.findByIdAndDelete(id);
    //     } catch (error) {
    //         throw new Error(`Error deleting restaurant: ${error}`);
    //     }
    // }

    // // Custom queries
    // static async findByPriceRange(priceRange: string): Promise<IRestaurant[]> {
    //     try {
    //         return await Restaurant.find({ priceRange });
    //     } catch (error) {
    //         throw new Error(`Error fetching restaurants by price range: ${error}`);
    //     }
    // }

    // static async findByCuisine(cuisine: string): Promise<IRestaurant[]> {
    //     try {
    //         return await Restaurant.find({ cuisine });
    //     } catch (error) {
    //         throw new Error(`Error fetching restaurants by cuisine: ${error}`);
    //     }
    // }

    // // Add menu item to a restaurant
    // static async addMenuItem(
    //     restaurantId: string,
    //     menuItem: {
    //         name: string;
    //         price: number;
    //         description?: string;
    //         category: string;
    //     }
    // ): Promise<IRestaurant | null> {
    //     try {
    //         return await Restaurant.findByIdAndUpdate(
    //             restaurantId,
    //             { $push: { menu: menuItem } },
    //             { new: true }
    //         );
    //     } catch (error) {
    //         throw new Error(`Error adding menu item: ${error}`);
    //     }
    // }

    // // Remove menu item from a restaurant
    // static async removeMenuItem(
    //     restaurantId: string,
    //     menuItemId: string
    // ): Promise<IRestaurant | null> {
    //     try {
    //         return await Restaurant.findByIdAndUpdate(
    //             restaurantId,
    //             { $pull: { menu: { _id: menuItemId } } },
    //             { new: true }
    //         );
    //     } catch (error) {
    //         throw new Error(`Error removing menu item: ${error}`);
    //     }
    // }
}
