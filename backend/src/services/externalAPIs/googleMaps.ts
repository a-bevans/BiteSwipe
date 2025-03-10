import axios from 'axios';

// Type definitions for Google Places API responses
export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_phone_number?: string;
  website?: string;
  price_level?: number;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now: boolean;
    weekday_text?: string[];
  };
  photos?: {
    photo_reference: string;
    height: number;
    width: number;
  }[];
  photos_url?: string[];
  types?: string[];
}

export interface GooglePlaceSearchResult {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
}

export class GooglePlacesService {
    private apiKey: string;
    private baseUrl: string = 'https://maps.googleapis.com/maps/api/place';
    
    private getPhotoUrl = (photoReference: string, maxWidth: number) => {
        return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
    };

    constructor() {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            throw new Error('Google Maps API key is required. Add GOOGLE_MAPS_API_KEY=<key> to .env');
        }
        // TypeScript now knows apiKey is definitely a string
        this.apiKey = apiKey;
        this.searchNearby = this.searchNearby.bind(this);
        this.getPlaceDetails = this.getPlaceDetails.bind(this);
    }

    async searchNearby(latitude: number, longitude: number, radius: number, keyword?: string): Promise<GooglePlaceSearchResult[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/nearbysearch/json`,{
                params: {
                    location: `${latitude},${longitude}`,
                    radius: radius,
                    type: 'restaurant',
                    keyword: keyword ?? 'food',
                    key: this.apiKey
                }
            });

            if(response.data.status !== 'OK') {
                console.error(`Google Places API error: ${response.data.status}`, { response: response.data });
                throw new Error('Failed to fetch nearby places');
            }

            const responseData = response.data as { status: string; results: GooglePlaceSearchResult[] };
            const results = responseData.results;
            const restaurantsOnly = results.filter((place) => {
                const types = (place.types ?? []);
                const restaurantTypes = [
                    'restaurant', 
                    'food', 
                    'cafe', 
                    'bakery', 
                    'meal_takeaway', 
                    'meal_delivery'
                ];
                
                return restaurantTypes.some(type => types.includes(type)) && 
                       (!types.includes('lodging') || types.indexOf('restaurant') < types.indexOf('lodging'));
            });
            
            return restaurantsOnly;

        } catch (error) {
            console.error(error);
            throw new Error('Failed to fetch nearby places');
        }
    }


    async getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
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

            const responseData = response.data as { status: string; result: GooglePlaceDetails };
            const result = responseData.result;
            if(result.photos) {
                result.photos_url = result.photos.map((photo: { photo_reference: string }) => 
                    this.getPhotoUrl(photo.photo_reference, 400)
                );
            }

            return result;
        } catch (error) {
            console.error(error);
            throw new Error('Failed to fetch place details');
        }
    }
}