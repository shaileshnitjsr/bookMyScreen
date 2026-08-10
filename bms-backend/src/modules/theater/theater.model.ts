import mongoose from "mongoose";
import { IThreater } from "./theater.interface";


const theaterSchema = new mongoose.Schema<IThreater>({
    name: { type: String, required: true },
    location: { type: String, required: true },
    logo: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
}, { timestamps: true });

export const TheaterModel = mongoose.model<IThreater>("Theater", theaterSchema);