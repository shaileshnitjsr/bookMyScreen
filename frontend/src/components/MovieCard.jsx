import { useState } from "react";
import { getMovieMeta } from "../data/movieMetadata";

export default function MovieCard({
  movie,
  index = 0,
  totalInRow = 5,
  onBookClick,
  onMoreInfoClick,
  isSavedInList,
  onToggleMyList,
}) {
  const [imgError, setImgError] = useState(false);
  const meta = getMovieMeta(movie.title);
  const isSaved = isSavedInList(movie.id);

  // Calculate transform origin for edge cards to prevent horizontal viewport overflow
  let transformOrigin = "center center";
  if (index === 0) {
    transformOrigin = "left center";
  } else if (index === totalInRow - 1) {
    transformOrigin = "right center";
  }

  return (
    <div
      className="netflix-card-container"
      style={{ "--transform-origin": transformOrigin }}
    >
      <div
        className="netflix-card-inner"
        onClick={() => onMoreInfoClick(movie)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onMoreInfoClick(movie);
          }
        }}
        aria-label={`${movie.title}, Rating ${meta.rating}`}
      >
        {/* Base Poster View */}
        <div className="card-poster-frame">
          {meta.poster && !imgError ? (
            <img
              src={meta.poster}
              alt={movie.title}
              className="card-poster-image"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="card-poster-fallback">
              <span className="fallback-badge-text">CINEFLOW</span>
              <span className="fallback-glyph">{movie.title.slice(0, 2).toUpperCase()}</span>
              <span className="fallback-title-text">{movie.title}</span>
            </div>
          )}

          {/* Quick corner badges */}
          <div className="card-top-rating-badge">★ {meta.rating}</div>
          <div className="card-top-age-badge">{meta.ageRating}</div>
        </div>

        {/* Hover / Expanded Preview Panel */}
        <div className="card-expanded-preview">
          <div className="preview-media-banner">
            <img
              src={meta.backdrop || meta.poster}
              alt=""
              className="preview-banner-img"
              aria-hidden="true"
            />
            <div className="preview-banner-gradient" />
            <h4 className="preview-banner-title">{movie.title}</h4>
          </div>

          <div className="preview-body-content">
            {/* Quick Action Button Row */}
            <div className="preview-action-row">
              <div className="preview-action-left">
                <button
                  className="preview-circle-btn play-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookClick(movie);
                  }}
                  title="Book tickets for this movie"
                  aria-label="Book tickets"
                >
                  ▶
                </button>

                <button
                  className={`preview-circle-btn list-btn ${isSaved ? "saved" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMyList(movie.id);
                  }}
                  title={isSaved ? "Remove from My List" : "Add to My List"}
                  aria-label="Toggle My List"
                >
                  {isSaved ? "✓" : "+"}
                </button>
              </div>

              <button
                className="preview-circle-btn info-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoreInfoClick(movie);
                }}
                title="View movie synopsis and details"
                aria-label="More information"
              >
                ⌄
              </button>
            </div>

            {/* Quick Metadata Line */}
            <div className="preview-meta-line">
              <span className="meta-match-score">{meta.matchPercentage}</span>
              <span className="meta-age-tag">{meta.ageRating}</span>
              <span className="meta-duration-tag">{movie.duration_minutes}m</span>
              <span className="meta-hd-badge">HD</span>
            </div>

            {/* Genres Tagline */}
            <div className="preview-genre-tags">
              {meta.genreTags?.slice(0, 3).map((tag, i) => (
                <span key={tag} className="genre-bullet-tag">
                  {tag}
                  {i < Math.min(meta.genreTags.length, 3) - 1 && (
                    <span className="genre-separator">•</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
