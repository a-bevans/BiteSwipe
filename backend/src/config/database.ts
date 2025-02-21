import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
    try {
        const dbUri = process.env.DB_URI || 'mongodb://mongo:27017';
        await mongoose.connect(dbUri);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};
