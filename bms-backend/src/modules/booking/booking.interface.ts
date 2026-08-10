import mongoose from "mongoose";

export interface IBooking {
  bookingRef: string;
  userId: mongoose.Types.ObjectId;
  showId: mongoose.Types.ObjectId;
  seats: string[];
  status: "CONFIRMED" | "FAILED" | "CANCELLED";
  bookingDateTime: Date;
  paymentId: string;
  paymentMethod: string;
  bookingFee: {
    ticketPrice: number;
    total: number;
    convenience: number;
  };
}
