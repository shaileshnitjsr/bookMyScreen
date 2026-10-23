import { useEffect, useRef } from "react";
import { getMovieMeta } from "../data/movieMetadata";

export default function MovieDetailsModal({
  movie,
  onClose,
  onBookClick,
  isSavedInList,
  onToggleMyList,
}) {
  const modalContentRef = useRef(null);

  useEffect(() => {
    // Lock scroll on background
    document.body.style.overflow = "hidden";

    // Close on Escape key
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!movie) return null;

  const meta = getMovieMeta(movie.title);
  const isSaved = isSavedInList(movie.id);

  return (
    <div
      className="netflix-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${movie.title} Details`}
    >
      <div
        className="netflix-modal-dialog"
        ref={modalContentRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="modal-close-icon-btn"
          onClick={onClose}
          aria-label="Close details"
        >
          ✕
        </button>

        {/* Modal Hero Banner */}
        <div className="modal-hero-cover">
          <img
            src={meta.backdrop || meta.poster}
            alt=""
            className="modal-hero-image"
            aria-hidden="true"
          />
          <div className="modal-hero-gradient" />

          <div className="modal-hero-controls">
            <h2 className="modal-title-text">{movie.title}</h2>

            <div className="modal-action-row">
              <button
                className="modal-primary-book-btn"
                onClick={() => {
                  onClose();
                  onBookClick(movie);
                }}
              >
                <span className="btn-symbol">▶</span>
                <span>Book Tickets</span>
              </button>

              <button
                className={`modal-circle-list-btn ${isSaved ? "saved" : ""}`}
                onClick={() => onToggleMyList(movie.id)}
                aria-label={isSaved ? "Remove from My List" : "Add to My List"}
                title={isSaved ? "In My List" : "Add to My List"}
              >
                {isSaved ? "✓" : "+"}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Information Body */}
        <div className="modal-body-container">
          <div className="modal-body-left">
            <div className="modal-meta-row">
              <span className="modal-score-badge">{meta.matchPercentage} Match</span>
              <span className="modal-year-badge">{meta.year}</span>
              <span className="modal-age-badge">{meta.ageRating}</span>
              <span className="modal-duration-badge">{movie.duration_minutes} min</span>
              <span className="modal-hd-badge">4K ULTRA HD</span>
            </div>

            {meta.tagline && (
              <p className="modal-tagline">“{meta.tagline}”</p>
            )}

            <p className="modal-synopsis">{movie.description}</p>
          </div>

          <div className="modal-body-right">
            <div className="modal-info-field">
              <span className="field-label">Director:</span>
              <span className="field-value">{meta.director}</span>
            </div>

            <div className="modal-info-field">
              <span className="field-label">Cast:</span>
              <span className="field-value">{meta.cast}</span>
            </div>

            <div className="modal-info-field">
              <span className="field-label">Genres:</span>
              <span className="field-value">{meta.genre}</span>
            </div>

            <div className="modal-info-field">
              <span className="field-label">Language:</span>
              <span className="field-value">{movie.language}</span>
            </div>

            <div className="modal-info-field">
              <span className="field-label">Audio & Formats:</span>
              <span className="field-value">{meta.formats}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
