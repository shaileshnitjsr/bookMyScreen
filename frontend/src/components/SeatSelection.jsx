import { useMemo } from "react";

export default function SeatSelection({
  movie,
  show,
  seats = [],
  selectedSeats = [],
  seatsLoading,
  seatsError,
  onToggleSeat,
  onBookSeats,
  bookingLoading,
  bookingError,
  onBack,
}) {
  const seatRows = useMemo(() => {
    return seats.reduce((groups, seat) => {
      if (!groups[seat.row_label]) {
        groups[seat.row_label] = [];
      }
      groups[seat.row_label].push(seat);
      return groups;
    }, {});
  }, [seats]);

  const totalPrice = useMemo(() => {
    return seats
      .filter((seat) => selectedSeats.includes(seat.seat_id))
      .reduce((sum, seat) => sum + Number(seat.price), 0);
  }, [seats, selectedSeats]);

  const selectedSeatLabels = useMemo(() => {
    return seats
      .filter((s) => selectedSeats.includes(s.seat_id))
      .map((s) => `${s.row_label}${s.seat_number}`);
  }, [seats, selectedSeats]);

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
    <section className="booking-subview-section" aria-label="Seat Selection">
      <div className="subview-nav-bar">
        <button className="subview-back-btn" onClick={onBack}>
          ← Back to Showtimes
        </button>
      </div>

      {/* Screen Header Info */}
      <div className="seat-screen-meta-banner">
        <div>
          <span className="header-stage-tag">STEP 2 OF 2 • SELECT YOUR SEATS</span>
          <h2 className="seat-movie-title">{movie.title}</h2>
          <p className="seat-theatre-details">
            {show.theatre_name} • {show.screen_name} ({show.city})
          </p>
          <p className="seat-showtime-timing">
            🗓 {formatShowTime(show.starts_at)}
          </p>
        </div>
      </div>

      {seatsLoading && (
        <div className="flow-loading-box">
          <div className="flow-spinner" />
          <p>Loading auditorium seating arrangement...</p>
        </div>
      )}

      {seatsError && (
        <div className="flow-error-banner" role="alert">
          <p>Could not load seat map: {seatsError}</p>
        </div>
      )}

      {!seatsLoading && !seatsError && seats.length === 0 && (
        <div className="flow-empty-box">
          <p>No seats were returned for this screen.</p>
        </div>
      )}

      {!seatsLoading && !seatsError && seats.length > 0 && (
        <div className="auditorium-hall-card">
          {/* Cinema Projection Screen Arc */}
          <div className="cinema-screen-rig">
            <div className="curved-projection-screen">
              <span className="screen-indicator-text">CINEMA PROJECTION SCREEN</span>
            </div>
            <div className="projection-beam-glow" />
          </div>

          {/* Seat Legend */}
          <div className="auditorium-legend-bar">
            <div className="legend-entry">
              <span className="legend-chip available" />
              <span>Available</span>
            </div>
            <div className="legend-entry">
              <span className="legend-chip selected" />
              <span>Selected</span>
            </div>
            <div className="legend-entry">
              <span className="legend-chip unavailable" />
              <span>Unavailable</span>
            </div>
          </div>

          {/* Seat Grid Map */}
          <div className="auditorium-seating-grid">
            {Object.entries(seatRows).map(([rowLabel, rowSeats]) => (
              <div className="auditorium-row" key={rowLabel}>
                <span className="row-letter-guide left">{rowLabel}</span>

                <div className="row-seats-cluster">
                  {rowSeats.map((seat) => {
                    const isSelected = selectedSeats.includes(seat.seat_id);
                    const isUnavailable = seat.status !== "available";

                    return (
                      <button
                        key={seat.seat_id}
                        className={`auditorium-seat-btn ${
                          isSelected ? "seat-state-selected" : ""
                        } ${isUnavailable ? "seat-state-unavailable" : ""}`}
                        disabled={isUnavailable}
                        onClick={() => onToggleSeat(seat)}
                        aria-pressed={isSelected}
                        aria-label={`Row ${seat.row_label}, Seat ${seat.seat_number}, Price ₹${seat.price}`}
                        title={`Row ${seat.row_label}, Seat ${seat.seat_number} — ₹${seat.price} (${seat.status})`}
                      >
                        {seat.seat_number}
                      </button>
                    );
                  })}
                </div>

                <span className="row-letter-guide right">{rowLabel}</span>
              </div>
            ))}
          </div>

          {/* Sticky Checkout Summary Card */}
          <div className="auditorium-checkout-dock">
            <div className="checkout-selection-stats">
              <span className="selected-count-label">
                {selectedSeats.length} seat
                {selectedSeats.length === 1 ? "" : "s"} selected
                {selectedSeatLabels.length > 0 && ` (${selectedSeatLabels.join(", ")})`}
              </span>
              <div className="checkout-price-callout">
                <span className="price-prefix">Total:</span>
                <span className="price-value">₹{totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <button
              className="checkout-reserve-btn"
              disabled={selectedSeats.length === 0 || bookingLoading}
              onClick={onBookSeats}
            >
              {bookingLoading ? (
                <span className="btn-loading-flex">
                  <span className="spinner-micro" />
                  <span>Reserving Seats...</span>
                </span>
              ) : (
                <span>Continue to Reserve</span>
              )}
            </button>
          </div>

          {bookingError && (
            <div className="flow-error-banner booking-error" role="alert">
              <span className="error-sign">⚠️</span>
              <p>{bookingError}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
