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

                    console.log('Creating and Storing restaurant =: ', details);

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
}
