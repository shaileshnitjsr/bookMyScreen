import mongoose from "mongoose";
import { generateBookingReference } from "../../utils";
import { IBooking } from "./booking.interface";
import BookingModel from "./booking.model";
import Razorpay from "razorpay";
import { config } from "../../config/config";
import { updateSeatStatus } from "../show/show.service";
import path from "path";


export const createBooking = async (bookingData: IBooking, userId: string) => {

    // 🔹 1. Basic validation
    if(!bookingData.showId || !bookingData.seats || bookingData.seats.length === 0 || !bookingData.paymentId || !bookingData.bookingFee) {
        throw new Error(`Invalid booking data!`)
    }
    
    // 🔹 2. Destructure all properties from body
    const { showId, seats, paymentId, bookingFee } = bookingData;

    // 🔹 3. Generate unique booking reference
    const bookingRef = generateBookingReference();

    // 🔹 4. Start Transaction // Protects against race condition
    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        // 🔹 5. Critical Query (Check if ANY of the requested seats are already booked)
        const existingBooking = await BookingModel.findOne({
                showId, status : "CONFIRMED", seats: { $in: seats }
            }).session(session);
        
        if(existingBooking){
            throw new Error(`One or more of the requested seats are already booked!`);
        }  
        
        // 🔹 6. Verify Payement
        // - Fetch payment details and validate
        const razorpay = new Razorpay({
            key_id : config.razorpayKey,
            key_secret : config.razorpaySecret
        });

        const paymentDetails = await razorpay.payments.fetch(paymentId);

        if(paymentDetails.status !== "captured") {
            throw new Error(`Payment not successful!`)  
        }

        // 🔹 7. Create Booking
        const [booking] = await BookingModel.create([
            {
                bookingRef,
                userId,
                showId,
                seats,
                status: "CONFIRMED",
                paymentId,
                paymentMethod: paymentDetails.method,
                bookingFee,
             }
         ], {session});

         // 🔹 8. Update Seat Availability in Show Document
         await updateSeatStatus(showId, seats, "BOOKED", session);

         // 🔹 9. Commit Transaction
        await session.commitTransaction();
        session.endSession();

        return booking;
        

    }catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }


};

export const getAllBookings = async (userId : string) => {
    return await BookingModel.find({userId})
    .populate(
        {
            path : "showId",
            select : "startTime date audioType",
            populate : [
                {
                path : "movie",
                select : "title posterUrl duration format"
            },
            {
                path : "theater",
                select : "name location city state"
            }
            ]
        }
    ).sort({ createdAt : -1 }); // latest booking first
}