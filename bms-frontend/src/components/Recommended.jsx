import React from "react";
import { movies } from "../utils/constants";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRecommendedMovies } from "../apis";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../context/LocationContext";

const Recommended = () => {

  const navigate = useNavigate();
  const { location } = useLocation();

  const handleNavigate = (movie) => {
    const originalTitle = movie.title;
    const cleanedTitle = originalTitle.includes(":") ? originalTitle.replace(/:/g, "") : originalTitle;
    const formattedTitle = cleanedTitle.replace(/\s+/g, "-").toLowerCase();
    navigate(`/movies/${location}/${formattedTitle}/${movie._id}/ticket`)
  }

  // API CALL
  const { data: recMovies, isError } = useQuery({
    queryKey: ["recommendedMovies"],
    queryFn: async () => {
      return await getRecommendedMovies();
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    console.log("Something went wrong!");
  }

  return (
    <div className="w-full py-6 bg-white">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="items-center flex justify-between mb-4">
          <h2 className="text-2xl font-semibold">Recommende Movies</h2>
          <span 
          onClick={() => navigate("/movies")}
            className="text-md text-red-500 cursor-pointer hover:underline
                font-medium"
          >
            See All
          </span>
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4
             xl:grid-cols-5 gap-4"
        >
          {recMovies?.data.topMovies.map((movie, i) => (
            <div key={i} onClick={() => handleNavigate(movie)} className="rounded overflow-hidden cursor-pointer">
              <div className="relative">
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-full h-[300px] object-cover rounded"
                />
              </div>
              <div
                className="bg-black text-white text-sm px-2 py-1 flex items-center
              justify-between "
              >
                <span>⭐ {movie.rating}/10</span>
                <span>{movie.votes} Votes</span>
              </div>
              <div className="px-2 py-1">
                <h3 className="font-semibold text-lg">{movie.title}</h3>
                <p className="text-md text-gray-500">
                  {movie.genre.join(" | ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Recommended;
