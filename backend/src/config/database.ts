import mongoose from 'mongoose';
import { Db } from 'mongodb';

export class Database {
    private connected: Promise<Db>;
    private mongoUrl: string;
    private dbName: string;

    constructor(mongoUrl: string, dbName: string) {
        this.mongoUrl = mongoUrl;
        this.dbName = dbName;
        this.connected = new Promise<Db>((resolve, reject) => {
            mongoose.connect(this.mongoUrl, { dbName: this.dbName})
                .then(() => {
                    console.log(`[Mongoose] Connected to ${this.mongoUrl}/${this.dbName}`);
                    resolve(mongoose.connection.db);
                })
                .catch((err) => {
                    console.error(`[Mongoose] Connection error: ${err}`);
                    reject(err);
                })
        });
    }

    async status(): Promise<{error: Error | null, url: string, db: string}> {
        try {
            await this.connected;
            return { error: null, url: this.mongoUrl, db: this.dbName};
        } catch(err) {
            return { error: err as Error, url: this.mongoUrl, db: this.dbName};
        }
    }
    

    /**
     * Throws an error if the connection is not established.
     * @pre The `Database` instance must be initialized.
     * @pre Restaurant Object should be define using type or interface.
     * @post Returns Restaurants.
     */
    // async getReastaurants(): Promise<Restaurant[]> {
    //     const db = await this.connected;
    //     return new Promise((resolve, reject) => {
    //         // TODO:
    //     })
    // }
}
