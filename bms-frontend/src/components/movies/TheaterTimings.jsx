import { useState } from "react";
import dayjs from "dayjs";
import { theatres } from "../../utils/constants";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getShowsByMovieAndLocation } from "../../apis";
import { useLocation } from "../../context/LocationContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const TheaterTimings = ({movieId}) => {
  const navigate = useNavigate();
  const { location } = useLocation();
  const { auth, toggleModal } = useAuth();

  const today = dayjs();
  const [selectedDate, setSelectedDate] = useState(today);
  const formattedDate = selectedDate.format("DD-MM-YYYY");

  const next7days = Array.from({ length: 7 }, (_, i) => today.add(i, "day"));


  const { data: showData, isLoading, isError } = useQuery({
    queryKey : ["show", movieId, location, formattedDate],
    queryFn : async () => await getShowsByMovieAndLocation(movieId, location, formattedDate),
    placeholderData : keepPreviousData,
    select : (res) => res.data
  })

  console.log(showData);

  return (
    <>
      <hr className="my-2 border-gray-200" />
      <div className="flex items-center gap-2 mb-4 overflow-x-auto py-4 px-2">
        {next7days.map((date, i) => {
          const isSelected = selectedDate.isSame(date, "day");
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(date)}
              className={`flex cursor-pointer flex-col border border-gray-200 items-center px-3 py-2 rounded-lg min-w-[50px] ${
                isSelected
                  ? "bg-black text-white font-semibold"
                  : "text-black hover:bg-gray-100"
              }`}
            >
              <span className="text-sm font-black">{date.format("D")}</span>
              <span className="text-xs">{date.format("ddd")}</span>
              <span className="text-[10px]">
                {date.format("MMM").toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Theater */}
      <div className="space-y-8 px-4 mb-10">
        {
          showData?.length === 0 && (
            <div className="text-center text-gray-500">
              No shows available for the selected date.
              </div>
          )
        }
        {showData?.map((curr, i) => (
          <div key={i}>
            <div className="flex items-start gap-3 mb-2">
              <img
                src={curr.theater.theaterDetails.logo}
                alt="logo"
                className="w-8 h-8 object-contain"
              />
              <div>
                <p className="font-semibold">{curr.theater.theaterDetails.name}</p>
                <p className="text-sm text-gray-500">Allows Cancellation</p>
              </div>
            </div>
            {/* // Timings */}
            <div className="flex flex-wrap gap-3 ml-11">
                {
                    curr.theater.shows.map((slot, i) => {
                      const theaterId = curr.theater.theaterDetails._id;
                      const movieName = curr.movie.title;
                      return (
                        <button 
                        onClick={() => {
                          if(!auth){
                            toggleModal();
                            return;
                          }
                          navigate(`/movies/${movieId}/${movieName}/${location}/theater/${theaterId}/show/${slot._id}/seat-layout`)
                        }}
                        key={i} className="border cursor-pointer hover:bg-gray-100 border-gray-300 rounded-[16px] px-12 py-2 text-sm flex flex-col items-center justify-center">
                            <span className="leading-tight font-semibold">{slot.startTime}</span>
                            <span className="text-[10px] text-gray-500 font-black">{slot.audioType.toUpperCase()}</span>
                        </button>
                      )
                    })
                }
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default TheaterTimings;
