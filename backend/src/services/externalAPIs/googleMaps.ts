import axios from 'axios';

export class GooglePlacesService {
    private apiKey: string;
    private baseUrl: string = 'https://maps.googleapis.com/maps/api/place';
    
    private getPhotoUrl = (photoReference: string, maxWidth: number) => {
        return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
    };

    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!this.apiKey) {
            throw new Error('Google Maps API key is required. Add GOOGLE_MAPS_API_KEY=<key> to .env');
        }
        this.searchNearby = this.searchNearby.bind(this);
        this.getPlaceDetails = this.getPlaceDetails.bind(this);
    }

    async searchNearby(latitude: number, longitude: number, radius: number, keyword?: string) {
        try {
            const response = await axios.get(`${this.baseUrl}/nearbysearch/json`,{
                params: {
                    location: `${latitude},${longitude}`,
                    radius: radius,
                    type: 'restaurant',
                    keyword: keyword || 'food',
                    key: this.apiKey
                }
            });

            if(response.data.status !== 'OK') {
                console.error(`Google Places API error: ${response.data.status}`, { response: response.data });
                throw new Error('Failed to fetch nearby places');
            }

            const restaurantsOnly = response.data.results.filter((place: any) => {
                // Check if the place has restaurant-related types
                const types = place.types || [];
                const restaurantTypes = [
                    'restaurant', 
                    'food', 
                    'cafe', 
                    'bakery', 
                    'meal_takeaway', 
                    'meal_delivery'
                ];
                
                // Make sure at least one restaurant-related type is present
                // AND ensure 'lodging' is not the primary type (to exclude hotels)
                return restaurantTypes.some(type => types.includes(type)) && 
                       (!types.includes('lodging') || types.indexOf('restaurant') < types.indexOf('lodging'));
            });
            
            return restaurantsOnly;

        } catch (error) {
            console.error(error);
            throw new Error('Failed to fetch nearby places');
        }
    }


    async getPlaceDetails(placeId: string) {
        try {
            const response = await axios.get(`${this.baseUrl}/details/json`, {
                params: {
                    place_id: placeId,
                    fields: 'name,formatted_address,geometry,formatted_phone_number,website,price_level,rating,user_ratings_total,opening_hours,photos,types',
                    key: this.apiKey
                }
            });

            if (response.data.status !== 'OK') {
                console.error(`Google Places API error: ${response.data.status}`);
                throw new Error('Failed to fetch place details');
            }

            if(response.data.result.photos) {
                response.data.result.photos_url = response.data.result.photos.map((photo: any) => 
                    this.getPhotoUrl(photo.photo_reference, 400)
                );
            }

            return response.data.result;
        } catch (error) {
            console.error(error);
            throw new Error('Failed to fetch place details');
        }
    }
}