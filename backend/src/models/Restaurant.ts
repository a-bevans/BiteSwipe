import mongoose, { Document } from 'mongoose';

export interface IRestaurant {
    name: string;
    location: {
        address: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
    };
    contact: {
        phone: string;
        website: string;
    };
    menu: {
        categories: {
            name: string;
            items: {
                name: string;
                description: string;
                price: number;
                imageUrl?: string;
            }[];
        }[];
    };
    images: {
        primary: string;
        gallery: string[];
    };
    sourceData: {
        googlePlaceId?: string;
        yelpId?: string;
        lastUpdated: Date;
    };
}

const RestaurantSchema = new mongoose.Schema<IRestaurant>({
    name: { type: String },
    location: {
        address: { type: String },
        coordinates: {
            latitude: {type: Number},
            longitude: {type: Number}
        } 
    },
    contact: {
        phone: {type: String},
        website: {type: String}
    },
    menu: {
        categories: [{
            name: { type: String},
            items: [{
                name: { type: String},
                description: { type: String},
                price: { type: Number},
                imageUrl: { type: String}
            }]
        }]
    },
    images: {
        primary: { type: String },
        gallery: [{ type: String}]
    },
    sourceData: {
        googlePlaceId: { type: String },
        yelpId: { type: String },
        lastUpdated: { type: Date, default: Date.now }
    },
});

//RestaurantSchema.index({ 'location.coordinates': '2dsphere' });

export const Restaurant = mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);