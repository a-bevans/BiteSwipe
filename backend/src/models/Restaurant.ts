import { Schema, model, Document } from 'mongoose';

// Define a separate interface for the menu item structure
interface IMenuItem {
    name: string;
    price: number;
    description?: string;
    category: string;
}

// Define the base restaurant interface
interface IRestaurantBase {
    name: string;
    cuisine: string;
    address: string;
    rating: number;
    priceRange: '$' | '$$' | '$$$' | '$$$$';
    menu: IMenuItem[];
    createdAt: Date;
    updatedAt: Date;
}

// Export the interface for the document
export interface IRestaurant extends Document, IRestaurantBase {
}

const menuItemSchema = new Schema<IMenuItem>({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
    category: { type: String, required: true }
});

const RestaurantSchema = new Schema<IRestaurant>(
    {
        name: { type: String, required: true },
        cuisine: { type: String, required: true },
        address: { type: String, required: true },
        rating: { type: Number, default: 0, min: 0, max: 5 },
        priceRange: { 
            type: String, 
            enum: ['$', '$$', '$$$', '$$$$'], 
            default: '$$' 
        },
        menu: [menuItemSchema]
    },
    { 
        timestamps: true 
    }
);

export const Restaurant = model<IRestaurant>('Restaurant', RestaurantSchema);
