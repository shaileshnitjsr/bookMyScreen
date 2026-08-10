import React from 'react'
import { useLocation } from '../../context/LocationContext';
import { useNavigate } from 'react-router-dom';

const MovieCard = ({movie}) => {
  console.log(movie);
  const navigate = useNavigate();
  const { location } = useLocation();
  
  const handleNavigate = (movie) => {
      const originalTitle = movie.title;
      const cleanedTitle = originalTitle.includes(":") ? originalTitle.replace(/:/g, "") : originalTitle;
      const formattedTitle = cleanedTitle.replace(/\s+/g, "-").toLowerCase();
      navigate(`/movies/${location}/${formattedTitle}/${movie._id}/ticket`)
  }

  return (
    <div onClick={() =>handleNavigate(movie)} className='w-40 md:w-52 cursor-pointer'>
        <img src={movie.posterUrl} alt={movie.title} className='rounded-lg shadow-md' />
        <p className='mt-2 font-medium'>{movie.title}</p>
        <p className='text-xs text-gray-500'>{movie.rating} | {movie.votes}</p>
        <p className='text-sm text-gray-600'>{movie.age}</p>
        <p className='text-sm text-gray-500 truncate'>{movie.languages.join(" | ")}</p>
    </div>
  )
}

export default MovieCard