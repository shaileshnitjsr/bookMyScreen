import React, { useEffect, useState } from "react";
import Header from "../components/seat-layout/Header";
import dayjs from "dayjs";
import { calculateTotalPrice, groupSeatsByType } from "../utils";
import { FaInfoCircle } from "react-icons/fa";
import { BiSolidOffer } from "react-icons/bi";
import { CiCircleQuestion, CiUser } from "react-icons/ci";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "../context/LocationContext";
import { useSeatContext } from "../context/SeatContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { razorPayScript } from "../utils/constants";
import { useMutation } from "@tanstack/react-query";
import { bookShow, createOrderRazorpay, verifyPaymentRazorpay } from "../apis/index";
import { socket  } from "../utils/socket";

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    }

    document.body.appendChild(script);
  })
}

const Checkout = () => {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes = 300 seconds
  useEffect(() => {

    const interval = setInterval(() => {
        setTimeLeft(prev => {
          if(prev <= 1){
            clearInterval(interval);

            socket.emit("unlock-seats", {
              showId: showData._id,
              userId: user._id
            })

            toast.error("Time expired!")
            navigate("/");

            return 0;
          }
          
          return prev - 1;
        })
    }, 1000)

    return () => clearInterval(interval) // cleanup

  }, [])

  const navigate = useNavigate();
  const { user } = useAuth();
  const { location } = useLocation();
  const { selectedSeats, shows: showData } = useSeatContext();
  const { base, tax, total } = calculateTotalPrice(selectedSeats);

  useEffect(() => {
    console.log(showData)
    if (!showData || selectedSeats.length === 0) {
      navigate("/");
    }
  }, []);


  /* Payment Gateway Integration Start */

  const createOrderMutation = useMutation({
    mutationFn: (reqData) => createOrderRazorpay(reqData),
    onSuccess: (data) => {
      
      const orderData = data?.data;

      
      const options = {
        key: `${import.meta.env.VITE_RAZORPAY_API_KEY}`,
        amount: orderData?.amount,
        currency: orderData?.currency,
        name: "BookMyScreen",
        description: "Secure Payment for Your Booking",
        order_id: orderData?.id,
        handler: async function (response) {
          console.log(response);
          verifyPaymentMutation.mutate(response);


          const reqData = {
            showId: showData._id,
            seats: selectedSeats,
            paymentId: response.razorpay_payment_id,
            bookingFee: {
              ticketPrice: base,
              total : total,
              convenience: tax
            }
          }

          bookTicketMutation.mutate(reqData);
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone,
        },
        theme: { color: "#025cca" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();


    }, 
    onError : (err) => {
      console.log(err);
    }
  })

  const verifyPaymentMutation = useMutation({
    mutationFn : (reqData) => verifyPaymentRazorpay(reqData),
    onSuccess: (data) => {
      toast.success(data?.data.message)
    },
    onError: (err) => {
      console.log(err);
    }
  })

  const bookTicketMutation = useMutation({
    mutationFn : (reqData) => bookShow(reqData),
    onSuccess: (data) => {
      console.log(data);
      toast.success(data?.data?.message);
      socket.emit("unlock-seats", {
        showId: showData._id,
        userId: user._id,
        seatIds: selectedSeats
      })
      navigate(`/profile/${user._id}/booking`);
    },
    onError: (err) => {
      console.log(err);
    }
  })

  const handleBookSeat = async () => {
      try {
        console.log(razorPayScript);
        const res = await loadScript(razorPayScript);
        console.log(res)
        if(!res) {
          toast.error("Razorpay SDK failed to load. Are you online?", {
          variant: "warning",
          });
          return;
        }

        const reqData = {
          amount : total
        }


        // Call the API to create the order
        createOrderMutation.mutate(reqData);

      } catch (error) {
        console.log(error);
        toast.error(error);
      }
  }


  /* Payment Gateway Integration End */



  return (
    <div className="min-h-screen w-full bg-white">
      <Header type="checkout" />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <p className="text-red-500 text-center mb-3 text-lg border rounded-[14px] border-dashed py-2 font-semibold">
          Time left: {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
          {String(timeLeft % 60).padStart(2, "0")}
        </p>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Section */}
          <div className="flex-1 space-y-4">
            {/* Movie Details */}
            <div className="flex gap-4">
              <img
                src={showData?.movie.posterUrl}
                alt={showData?.movie.title}
                className="w-[60px] h-[90px] rounded object-cover"
              />
              <div>
                <h3 className="font-semibold text-lg">
                  {showData?.movie.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {showData?.movie.certification} •{" "}
                  {showData?.movie.languages.join(", ")} •{" "}
                  {showData?.movie.format.join(", ")}
                </p>
                <p className="text-sm text-gray-600">
                  {showData?.theater.name}, {showData?.theater.city},{" "}
                  {showData?.theater.state}
                </p>
              </div>
            </div>
            {/* Show Details */}
            <div className="border border-gray-200 rounded-[24px] px-6 py-5">
              <p className="text-md font-medium border-b pb-5 border-gray-200">
                {dayjs(showData?.date, "DD-MM-YYYY")
                  .format("D MMMM YYYY")
                  .split(" ")
                  .slice(0, 2)
                  .join(" ")}{" "}
                &nbsp;•{" "}
                <span className="font-semibold">{showData?.startTime}</span>
              </p>
              <div className="flex items-center justify-between mt-4 mb-4">
                <div>
                  <p className="text-md mt-2 font-semibold">
                    {selectedSeats.length} ticket
                  </p>
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">
                      {groupSeatsByType(selectedSeats).map(
                        ({ type, seats }) => (
                          <p key={type} className="font-medium">
                            {type} - {seats.join(", ")}
                          </p>
                        ),
                      )}
                    </span>
                  </div>
                </div>
                <p className="text-md font-semibold mt-2">
                  <span className="text-gray-700">₹</span>
                  {base}
                </p>
              </div>
            </div>

            {/* Cancellation Notice */}
            <div className="bg-white border rounde-[24px] border-gray-200 text-yellow-800 text-sm px-6 py-5 tracking-wide">
              <span className="font-medium flex items-center gap-2">
                <FaInfoCircle size={24} /> No cancellation or refund available
                after payment.
              </span>
            </div>

            {/* Offers */}
            <div className="flex items-center justify-between border rounded-[24px] border-gray-200 px-6 py-5">
              <p className="font-medium text-sm flex items-center gap-2">
                <BiSolidOffer size={20} /> Available Offers
              </p>
              <p className="text-sm text-center text-blue-600 font-medium cursor-pointer">
                View all offers
              </p>
            </div>
          </div>

          {/* Right Section */}
          <div className="w-full lg:w-[300px] space-y-4">
            <h4 className="font-medium text-gray-900 text-lg">
              Payment Summary
            </h4>
            <div className="border border-gray-200 rounded-[24px] px-6 py-7 space-y-2">
              <div className="flex justify-between text-md">
                <span className="text-sm text-gray-500">Order amount</span>
                <span>₹{base}</span>
              </div>
              <div className="flex justify-between text-md pb-4">
                <span className="font-semibold text-sm">Taxes & fees (5%)</span>
                <span>₹{tax}</span>
              </div>
              <div className="flex justify-between text-md font-semibold border-t border-gray-200 pt-4">
                <span>To be paid</span>
                <span>₹{total}</span>
              </div>
            </div>

            {/* User details */}
            <h4 className="text-lg font-medium">Your details</h4>
            <div className="border flex items-start gap-3 border-gray-200 rounded-[24px] px-6 py-7">
              <CiUser size={24} />
              <div className="-mt-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-sm text-gray-600">+91-{user?.phone}</p>
                <p className="text-sm text-gray-600">{user?.email}</p>
                <p className="text-sm text-gray-600">{location}</p>
              </div>
            </div>

            {/* Terms and button */}
            <div className="border border-gray-200 rounded-[24px] px-6 py-5">
              <p className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <CiCircleQuestion size={24} /> Terms and conditions
              </p>
            </div>

            <div onClick={handleBookSeat} className="flex justify-between items-center bg-black rounded-[24px] px-6 py-4 cursor-pointer">
              <p className="text-white font-bold">
                ₹{total} <span className="text-xs font-medium">TOTAL</span>
              </p>
              <p className="text-white font-medium">Proceed To Pay</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
