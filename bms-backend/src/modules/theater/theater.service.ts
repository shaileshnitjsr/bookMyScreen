import { TheaterModel } from "./theater.model";

// 1. CreateTheater

import { IThreater } from "./theater.interface";

export const createTheater = async (data: IThreater): Promise<IThreater> => {
    return await TheaterModel.create(data);
}
// 2. GetAllTheaters
export const getAllTheaters = async (): Promise<IThreater[]> => {
    return await TheaterModel.find();
}
// 3. GetTheaterById
export const getTheaterById = async (id: string): Promise<IThreater | null> => {
    return await TheaterModel.findById(id);
}
// 4. GetTheaterByState
export const getTheaterByState = async (state: string): Promise<IThreater[]> => {
    return await TheaterModel.find({state: { $regex: state, $options: "i" }});
} 