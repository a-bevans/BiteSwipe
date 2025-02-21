import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurant extends Document {
    name: string;
    cuisine: string;
    address: string;
    rating: number;
    priceRange: string;
    menu: Array<{
        name: string;
        price: number;
        description: string;
        category: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>({
    name: { type: String, required: true },
    cuisine: { type: String, required: true },
    address: { type: String, required: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    priceRange: { type: String, enum: ['$', '$$', '$$$', '$$$$'], default: '$$' },
    menu: [{
        name: { type: String, required: true },
        price: { type: Number, required: true },
        description: { type: String },
        category: { type: String, required: true }
    }]
}, {
    timestamps: true
});

export const Restaurant = mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
