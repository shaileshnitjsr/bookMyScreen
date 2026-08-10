import Header from "../components/seat-layout/Header";
import Footer from "../components/seat-layout/Footer";
import { useParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getShowById } from "../apis/index";
import screenImg from "../assets/screen.png"; 
import { useSeatContext } from "../context/SeatContext";
import { useLocation } from "../context/LocationContext";
import { socket } from "../utils/socket";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const Seat = ({ seat, row, selectedSeats, lockedSeats , onClick }) => {
  const seatId = `${row}${seat.number}`;
  const isLocked = lockedSeats?.includes(seatId);
  const isSelected = selectedSeats.includes(seatId);

  return (
    <button
      className={`w-9 h-9 m-[2px] rounded-lg border text-sm
        ${
          seat.status === "BOOKED"
            ? "bg-gray-100 border-red-200 text-red-400 cursor-not-allowed"
            : isLocked
            ? "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed"
            : isSelected
            ? "bg-[#6e52fa] text-white border-[#cec4f7] border-3 cursor-pointer"
            : "hover:bg-gray-100 border-black cursor-pointer"
        }`}
      disabled={seat.status === "BOOKED" || isLocked}
      onClick={onClick}
    >
      {seat.status === "BOOKED" || isLocked ? "X" : seat.number}
    </button>
  );
};

const SeatLayout = () => {

  const [lockedSeats, setLockedSeats] = useState();
  const { selectedSeats, setSelectedSeats } = useSeatContext();
  const { location } = useLocation();

  const handleSelectSeat = (row, number) => {
    const seatId = `${row}${number}`;

    setSelectedSeats((prev) => 
      prev.includes(seatId) ? prev.filter((existingId) => existingId !== seatId) : [...prev, seatId]
    )
  
  }

  const { showId } = useParams();

  const {
    data: showData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["show", showId],
    queryFn: async () => await getShowById(showId),
    placeholderData: keepPreviousData,
    enabled: !!showId,
    select: (res) => res.data,
  });


  const isSelectedSeats = selectedSeats.length > 0;


  /* Socket.io Code start  */

  useEffect(() => {
    setSelectedSeats([]);
    socket.emit("join-show", {showId});
    socket.on("locked-seats-initials", ({seatIds}) => {
      setLockedSeats(seatIds);
    })

    socket.on("seat-locked", ({seatIds, showId: incommingShowId}) => {
      if(incommingShowId !== showId) return;

      setLockedSeats((prev) => [...new Set([...prev, ...seatIds])]);
    })

    socket.on("seat-unlocked", ({seatIds, showId:incommingShowId}) => {
      if(incommingShowId !== showId) return;

      setLockedSeats((prev) => prev.filter((id) => !seatIds.includes(id)));
    })

    socket.on("seat-locked-failed", ({showId,
        requested: seatIds,
        alreadyLocked,}) => {
          toast.error(`Some seats are already locked: ${alreadyLocked.join(", ")}`)
        })

  },[showId])


  console.log("lockedseats: ", lockedSeats);


  /* Socket.io Code ends */


  return (
    <>
      <div className="h-screen overflow-y-hidden">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 w-full z-10">
          <Header showData={showData} />
        </div>
        {/* Scrollable Seat Layout */}
         <div className="max-w-7xl mx-auto mt-[210px] px-6 pb-4 bg-white h-[calc(100vh-320px)] overflow-y-scroll scrollbar-hide">
          <div className="flex flex-col items-center justify-center">
            {showData?.seatLayout && (
              <div className="flex flex-col items-center justify-center">
                {Object.entries(
                  showData.seatLayout.reduce((acc, curr) => {
                    if (!acc[curr.type])
                      acc[curr.type] = { price: curr.price, rows: [] };
                    acc[curr.type].rows.push(curr);
                    return acc;
                  }, {})
                ).map(([type, { price, rows }]) => (
                  <div
                    key={type}
                    className="mb-12 w-full flex flex-col items-center justify-center"
                  >
                    <h2 className="text-center font-semibold text-lg mb-4">
                      {type} : ₹{price}
                    </h2>
                    <div className="space-y-2">
                      {rows.map((rowObj) => (
                        <div key={rowObj.row} className="flex items-center">
                          <div className="w-6 text-right mr-2 text-sm text-gray-600">
                            {rowObj.row}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {rowObj.seats.map((seat, i) => (
                              <Seat
                                key={i}
                                seat={seat}
                                row={rowObj.row}
                                selectedSeats={selectedSeats}
                                lockedSeats={lockedSeats}
                                onClick={() => handleSelectSeat(rowObj.row, seat.number)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-center mt-5">
              <img
                src={screenImg} // or "/screen.png" if in public
                alt="Screen"
                className="w-[300px] md:w-[400px] object-contain opacity-80"
              />
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="fixed bottom-0 left-0 w-full h-[100px] bg-white border-t border-gray-200 py-4 px-4 z-10">
          <Footer isSelected={isSelectedSeats} selectedSeats={selectedSeats} showData={showData} state={location}  />
        </div>
      </div>
    </>
  );
};

export default SeatLayout;
