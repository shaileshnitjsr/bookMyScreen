import React from "react";
import { ordersData } from "../../utils/constants";
import { MdChair } from "react-icons/md";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getUserBookings } from "../../apis";
import dayjs from "dayjs";

const BookingHistory = () => {

  const { data, isError } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      return await getUserBookings()
    },
    placeholderData: keepPreviousData
  })

  console.log(data?.data.bookings)

  if(isError){
    return (
      <div className="px-6 rounded-md">
        <h3 className="text-xl font-semibold mb-4">Your Orders</h3>
        <p className="text-gray-500">Failed to load bookings. Please try again later.</p>
      </div>
    )
  }

  return (
    <>
      <div className="px-6 rounded-md">
        <h3 className="text-xl font-semibold mb-4">Your Bookings</h3>

        {data?.data?.bookings?.map((booking) => (
          <>
            <div
              key={booking._id}
              className="bg-white p-5 rounded-md mb-2 overflow-hidden"
            >
              <div className="flex items-start gap-10">
                <img src={booking.showId.movie.posterUrl} alt="" className="w-30 h-40 object-cover rounded" />
                {/* Divider with fixed height same as image */}
                <div className="h-40 border-l border-gray-300 border-dashed"></div>

                <div className="flex items-start justify-between w-full">
                    <div className="flex-1">
                        <p className="font-normal text-lg">{booking.showId.movie.title}</p>
                        <p className="text-sm text-gray-500">{booking.showId.movie.format.join(" | ")}</p>
                        <p className="text-sm font-semibold text-gray-700 mt-2">
                            {dayjs(booking.showId.date, "DD-MM-YYYY").format("D MMMM YY")} - {booking.showId.startTime} {booking.showId.theater.name + booking
                            .showId.theater.location}
                        </p>
                        <small className="text-gray-700 mt-1">
                            Quantity: {booking.seats.length}
                        </small>
                        <p className="text-md font-semibold text-gray-700 mt-2">
                            <MdChair className="inline items-center mr-2" size={24} />
                            {booking.seats.join(", ")}
                        </p>
                    </div>
                    <p>M-Ticket</p>
                </div>
              </div>
              <div className="p-4 text-right">
                <p className="text-sm text-gray-500">Ticket: ₹{booking.bookingFee.ticketPrice} + Convenience Fees: ₹{booking.bookingFee.convenience}</p>
                <p className="text-xl font-bold">₹{booking.bookingFee.total}</p>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-8">
                <div>
                    <p className="font-semibold">Booking Date & Time</p>
                    <p>{dayjs(booking.bookingDateTime).format("DD MMM YYYY, h:mm A")}</p>
                </div>
                <div>
                    <p className="font-semibold">Payment Method</p>
                    <p>{booking.paymentMethod.toUpperCase()}</p>
                </div>
                <div>
                    <p className="font-semibold">Booking ID</p>
                    <p>{booking.bookingRef}</p>
                </div>
            </div>

          </>
        ))}
      </div>
    </>
  );
};

export default BookingHistory;
