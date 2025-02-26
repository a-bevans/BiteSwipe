import mongoose, { Document } from 'mongoose';

// // Define a separate interface for the menu item structure
// interface IMenuItem {
//     name: string;
//     price: number;
//     description?: string;
//     category: string;
// }

// // Define the base restaurant interface
// interface IRestaurantBase {
//     name: string;
//     cuisine: string;
//     address: string;
//     rating: number;
//     priceRange: '$' | '$$' | '$$$' | '$$$$';
//     menu: IMenuItem[];
//     createdAt: Date;
//     updatedAt: Date;
// }

// // Export the interface for the document
// export interface IRestaurant extends Document, IRestaurantBase {
// }

// const menuItemSchema = new Schema<IMenuItem>({
//     name: { type: String, required: true },
//     price: { type: Number, required: true },
//     description: String,
//     category: { type: String, required: true }
// });

// const RestaurantSchema = new Schema<IRestaurant>(
//     {
//         name: { type: String, required: true },
//         cuisine: { type: String, required: true },
//         address: { type: String, required: true },
//         rating: { type: Number, default: 0, min: 0, max: 5 },
//         priceRange: { 
//             type: String, 
//             enum: ['$', '$$', '$$$', '$$$$'], 
//             default: '$$' 
//         },
//         menu: [menuItemSchema]
//     },
//     { 
//         timestamps: true 
//     }
// );

// export const Restaurant = model<IRestaurant>('Restaurant', RestaurantSchema);

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