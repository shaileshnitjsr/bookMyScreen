import { useRef, useState, useEffect, useCallback } from "react";
import MovieCard from "./MovieCard";

export default function MovieRow({
  title,
  movies = [],
  onBookClick,
  onMoreInfoClick,
  isSavedInList,
  onToggleMyList,
}) {
  const rowRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollLimits = useCallback(() => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 15);
  }, []);

  useEffect(() => {
    checkScrollLimits();
    const el = rowRef.current;
    if (el) {
      el.addEventListener("scroll", checkScrollLimits, { passive: true });
      window.addEventListener("resize", checkScrollLimits);
    }
    return () => {
      if (el) el.removeEventListener("scroll", checkScrollLimits);
      window.removeEventListener("resize", checkScrollLimits);
    };
  }, [checkScrollLimits, movies]);

  const handleScroll = (direction) => {
    if (!rowRef.current) return;
    const { clientWidth } = rowRef.current;
    // Scroll roughly 75% of visible width for a natural Netflix slide
    const scrollAmount = direction === "left" ? -clientWidth * 0.75 : clientWidth * 0.75;
    rowRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  if (!movies || movies.length === 0) return null;

  return (
    <section className="netflix-movie-row-section" aria-label={title}>
      <h2 className="movie-row-header-title">{title}</h2>

      <div className="movie-row-slider-wrapper">
        {/* Left Scroll Paddle */}
        {canScrollLeft && (
          <button
            className="row-nav-paddle paddle-left"
            onClick={() => handleScroll("left")}
            aria-label={`Scroll ${title} left`}
          >
            <span className="paddle-chevron">‹</span>
          </button>
        )}

        {/* Scrollable Cards Track */}
        <div className="movie-row-slider-track" ref={rowRef}>
          {movies.map((movie, idx) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              index={idx}
              totalInRow={movies.length}
              onBookClick={onBookClick}
              onMoreInfoClick={onMoreInfoClick}
              isSavedInList={isSavedInList}
              onToggleMyList={onToggleMyList}
            />
          ))}
        </div>

        {/* Right Scroll Paddle */}
        {canScrollRight && (
          <button
            className="row-nav-paddle paddle-right"
            onClick={() => handleScroll("right")}
            aria-label={`Scroll ${title} right`}
          >
            <span className="paddle-chevron">›</span>
          </button>
        )}
      </div>
    </section>
  );
}
