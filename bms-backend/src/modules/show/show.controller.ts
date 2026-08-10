import { Request, Response, NextFunction } from "express";
import * as ShowService from "./show.service";
import { stat } from "fs";

export const createShow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const show = await ShowService.createShow(req.body);
        res.status(201).json(show);
    } catch (error) {
        next(error);
    }
}

export const getShowsByMovieDateLocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { movieId, state, date } = req.query;
        const shows = await ShowService.getShowsByMovieDateLocation(
            movieId as string,
            date as string,
            state as string
        )

        res.status(200).json(shows);

    } catch (error) {
        next(error);
    }
}

export const getShowById = async (req:Request, res:Response, next: NextFunction) => {
    try {
        const show = await ShowService.getShowById(req.params.id);
        res.status(200).json(show);
    } catch (error) {
        next(error);
    }
}
