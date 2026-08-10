import * as BookingService from "./booking.service";
import { Request, Response, NextFunction } from "express";

export const createBookingHandler = async (req: Request, res: Response, next: NextFunction) => {

    try{

        const booking = await BookingService.createBooking(req.body, req.user._id);
        res.json({
            success : true,
            message : "Booking successful!",
            booking
        }).status(201);

    }catch(error){
        next(error);
    }

}

export const getUserBookingsHandler = async (req: Request, res: Response, next: NextFunction) => {

    try{    
        const bookings = await BookingService.getAllBookings(req.user._id);
        res.json({
            success : true,
            message : "User bookings fetched successfully!",
            bookings
        }).status(200);
    }catch(error){
        next(error);
    }       
}