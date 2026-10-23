import { getMovieMeta } from "../data/movieMetadata";

export default function MyBookingsView({
  bookings = [],
  loading,
  error,
  onRefresh,
  onBrowseMovies,
}) {
  const formatTime = (value) => {
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
    <section className="booking-subview-section" aria-label="My Bookings">
      <div className="my-bookings-page-header">
        <div>
          <span className="header-stage-tag">ACCOUNT & TICKETS</span>
          <h2 className="my-bookings-title">My Bookings</h2>
          <p className="my-bookings-subtitle">
            View all active holds, confirmed cinema seats, and transaction records
          </p>
        </div>

        <button
          className="refresh-tickets-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh History"}
        </button>
      </div>

      {loading && (
        <div className="flow-loading-box">
          <div className="flow-spinner" />
          <p>Retrieving your ticket reservations from PostgreSQL...</p>
        </div>
      )}

      {error && (
        <div className="flow-error-banner" role="alert">
          <p>{error}</p>
          <button className="subview-back-btn" onClick={onRefresh} style={{ marginTop: "12px" }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="flow-empty-box">
          <span className="empty-ticket-glyph">🎟</span>
          <h3>No bookings recorded yet</h3>
          <p>You haven't reserved or booked any tickets for your account.</p>
          <button className="empty-browse-btn" onClick={onBrowseMovies}>
            Browse Movies Now
          </button>
        </div>
      )}

      {!loading && !error && bookings.length > 0 && (
        <div className="bookings-history-cards-grid">
          {bookings.map((booking) => {
            const meta = getMovieMeta(booking.movie_title);
            const isConfirmed = booking.status === "confirmed";
            const isPending = booking.status === "pending";
            const isExpired = booking.status === "expired";

            return (
              <div className="user-booking-ticket-card" key={booking.id}>
                {/* Header banner */}
                <div className="ticket-card-header">
                  <div className="ticket-header-meta">
                    <span className="ticket-id-tag">Booking #{booking.id}</span>
                    <span className="ticket-date-tag">{formatTime(booking.created_at)}</span>
                  </div>

                  <span
                    className={`ticket-status-pill ${
                      isConfirmed
                        ? "status-confirmed"
                        : isPending
                        ? "status-pending"
                        : isExpired
                        ? "status-expired"
                        : "status-other"
                    }`}
                  >
                    {isConfirmed && "✓ Confirmed"}
                    {isPending && "⏱ Pending"}
                    {isExpired && "✕ Expired"}
                    {!isConfirmed && !isPending && !isExpired && booking.status}
                  </span>
                </div>

                {/* Ticket body */}
                <div className="ticket-card-body">
                  <div className="ticket-movie-row">
                    <img
                      src={meta.poster}
                      alt={booking.movie_title}
                      className="ticket-poster-thumb"
                    />

                    <div className="ticket-movie-details">
                      <h4 className="ticket-movie-title">{booking.movie_title}</h4>
                      <p className="ticket-venue-info">
                        📍 {booking.theatre_name} • {booking.screen_name} ({booking.city})
                      </p>
                      <p className="ticket-showtime-info">
                        🎬 Showtime: {formatTime(booking.starts_at)}
                      </p>
                    </div>
                  </div>

                  {/* Seat tags list */}
                  <div className="ticket-seats-section">
                    <span className="seats-tag-label">Reserved Seats:</span>
                    <div className="ticket-seats-tags-list">
                      {booking.seats && booking.seats.length > 0 ? (
                        booking.seats.map((st) => (
                          <span key={st.seat_id} className="ticket-seat-tag">
                            Row {st.row_label}-{st.seat_number}
                          </span>
                        ))
                      ) : (
                        <span className="no-seats-recorded">No seat items attached</span>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="ticket-card-footer">
                    <div className="ticket-price-col">
                      <span className="price-title">Total:</span>
                      <span className="price-amount">₹{Number(booking.total_amount).toFixed(2)}</span>
                    </div>

                    {booking.provider_ref && (
                      <div className="ticket-provider-col">
                        <span className="ref-title">Ref:</span>
                        <code className="ref-code-hash">{booking.provider_ref}</code>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
