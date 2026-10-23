import { getMovieMeta } from "../data/movieMetadata";

export default function ShowtimeSelection({
  movie,
  shows = [],
  showsLoading,
  showsError,
  onSelectShow,
  onBack,
}) {
  const meta = getMovieMeta(movie.title);

  const formatShowTime = (value) => {
    if (!value) return "N/A";
    return new Date(value).toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="booking-subview-section" aria-label="Select Showtime">
      <div className="subview-nav-bar">
        <button className="subview-back-btn" onClick={onBack}>
          ← Back to Movies
        </button>
      </div>

      {/* Selected Movie Banner */}
      <div className="cinema-movie-header-card">
        <div className="header-card-poster">
          <img
            src={meta.poster}
            alt={movie.title}
            className="header-poster-img"
          />
        </div>

        <div className="header-card-info">
          <span className="header-stage-tag">STEP 1 OF 2 • SELECT SHOWTIME</span>
          <h2 className="header-movie-title">{movie.title}</h2>

          <div className="header-meta-pills">
            <span className="header-pill rating">★ {meta.rating}</span>
            <span className="header-pill duration">{movie.duration_minutes} min</span>
            <span className="header-pill language">{movie.language}</span>
            <span className="header-pill age">{meta.ageRating}</span>
          </div>

          <p className="header-genre-line">{meta.genre}</p>
          <p className="header-synopsis-snippet">{movie.description}</p>
        </div>
      </div>

      {/* Showtimes List */}
      <div className="cinema-showtimes-container">
        <h3 className="showtimes-section-heading">Available Screenings</h3>

        {showsLoading && (
          <div className="flow-loading-box">
            <div className="flow-spinner" />
            <p>Retrieving theatre schedule...</p>
          </div>
        )}

        {showsError && (
          <div className="flow-error-banner" role="alert">
            <p>Could not load showtimes: {showsError}</p>
          </div>
        )}

        {!showsLoading && !showsError && shows.length === 0 && (
          <div className="flow-empty-box">
            <p>No upcoming showtimes are currently scheduled for this title.</p>
          </div>
        )}

        {!showsLoading && !showsError && shows.length > 0 && (
          <div className="showtimes-cards-grid">
            {shows.map((show) => (
              <div className="theatre-show-card" key={show.show_id}>
                <div className="show-card-top">
                  <div className="theatre-title-box">
                    <h4 className="theatre-name">{show.theatre_name}</h4>
                    <span className="screen-badge">{show.screen_name}</span>
                  </div>
                  <p className="theatre-city">📍 {show.city}</p>
                </div>

                <div className="show-timing-box">
                  <span className="time-icon">🕒</span>
                  <span className="time-string">{formatShowTime(show.starts_at)}</span>
                </div>

                <div className="show-card-footer">
                  <div className="show-status-info">
                    <span className="seats-count-badge">
                      {show.available_seats} seats available
                    </span>
                    <span className="price-lead">
                      From ₹{show.min_price ?? "N/A"}
                    </span>
                  </div>

                  <button
                    className="select-seats-action-btn"
                    onClick={() => onSelectShow(show)}
                  >
                    Select Seats →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
