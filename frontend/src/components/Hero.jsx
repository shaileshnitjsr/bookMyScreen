import { useState } from "react";
import { getMovieMeta } from "../data/movieMetadata";

export default function Hero({
  featuredMovie,
  allMovies,
  onBookClick,
  onMoreInfoClick,
  onSelectFeatured,
  isSavedInList,
  onToggleMyList,
}) {
  const [loadedImageId, setLoadedImageId] = useState(null);

  if (!featuredMovie) return null;

  const imageLoaded = loadedImageId === featuredMovie.id;

  const meta = getMovieMeta(featuredMovie.title);
  const backdropUrl = meta.backdrop;
  const isSaved = isSavedInList(featuredMovie.id);

  // Pre-filter a subset of movies for the hero switcher
  const heroOptions = allMovies?.slice(0, 5) || [];

  return (
    <section className="netflix-hero-viewport" aria-label="Featured Movie">
      {/* Background Image & Layered Gradients */}
      <div className="hero-backdrop-stage">
        {backdropUrl && (
          <img
            key={featuredMovie.id}
            src={backdropUrl}
            alt=""
            className={`hero-backdrop-img ${imageLoaded ? "loaded" : ""}`}
            onLoad={() => setLoadedImageId(featuredMovie.id)}
            aria-hidden="true"
          />
        )}
        <div className="hero-vignette-left" />
        <div className="hero-fade-bottom" />
      </div>

      {/* Hero Content Overlay */}
      <div className="hero-overlay-container">
        <div className="hero-content-block">
          <div className="hero-eyebrow-line">
            <span className="hero-cinema-badge">CINEFLOW EXCLUSIVE</span>
            <span className="hero-format-pill">{meta.formats}</span>
          </div>

          <h1 className="hero-main-title">{featuredMovie.title}</h1>

          <div className="hero-meta-badges-line">
            <span className="meta-pill rating-pill">★ {meta.rating}</span>
            <span className="meta-pill match-pill">{meta.matchPercentage} Match</span>
            <span className="meta-pill age-pill">{meta.ageRating}</span>
            <span className="meta-pill duration-pill">{featuredMovie.duration_minutes} min</span>
            <span className="meta-pill genre-pill">{meta.genre}</span>
          </div>

          {meta.tagline && (
            <p className="hero-tagline-quote">“{meta.tagline}”</p>
          )}

          <p className="hero-synopsis-text">{featuredMovie.description}</p>

          <div className="hero-cta-button-row">
            <button
              className="hero-play-book-btn"
              onClick={() => onBookClick(featuredMovie)}
            >
              <span className="btn-symbol">▶</span>
              <span className="btn-text">Book Tickets</span>
            </button>

            <button
              className="hero-more-info-btn"
              onClick={() => onMoreInfoClick(featuredMovie)}
            >
              <span className="info-icon">ⓘ</span>
              <span>More Info</span>
            </button>

            <button
              className={`hero-circle-list-btn ${isSaved ? "saved" : ""}`}
              onClick={() => onToggleMyList(featuredMovie.id)}
              aria-label={isSaved ? "Remove from My List" : "Add to My List"}
              title={isSaved ? "In My List" : "Add to My List"}
            >
              {isSaved ? "✓" : "+"}
            </button>
          </div>
        </div>

        {/* Featured Movie Switcher Controls */}
        {heroOptions.length > 1 && (
          <div className="hero-switcher-dock">
            <span className="switcher-caption">Featured:</span>
            <div className="switcher-pills-row">
              {heroOptions.map((m) => (
                <button
                  key={m.id}
                  className={`switcher-pill-tab ${m.id === featuredMovie.id ? "active" : ""}`}
                  onClick={() => onSelectFeatured(m)}
                >
                  {m.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
