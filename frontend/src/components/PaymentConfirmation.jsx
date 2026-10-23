export default function PaymentConfirmation({
  booking,
  payment,
  paymentLoading,
  paymentError,
  onPay,
  onViewBookings,
  timeLeft,
}) {
  if (!booking) return null;

  const isConfirmed = booking.status === "confirmed" || payment?.status === "succeeded";

  const formatCountdown = (seconds) => {
    if (seconds === null || seconds === undefined) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="payment-confirmation-wrapper" role="status">
      <div className="payment-card-header">
        <div>
          <span className="payment-card-eyebrow">
            {isConfirmed ? "BOOKING STATUS" : "TEMPORARY HOLD"}
          </span>
          <h3 className="payment-card-title">
            {isConfirmed ? "🎉 Booking Confirmed!" : "⏱ Reservation Held"}
          </h3>
        </div>

        <span className={`payment-status-badge ${isConfirmed ? "confirmed" : "pending"}`}>
          {isConfirmed ? "✓ Confirmed" : "Pending Payment"}
        </span>
      </div>

      {/* Booking Specs Grid */}
      <div className="payment-specs-grid">
        <div className="spec-item">
          <span className="spec-label">Booking ID</span>
          <span className="spec-val highlight">#{booking.id}</span>
        </div>

        <div className="spec-item">
          <span className="spec-label">Total Amount</span>
          <span className="spec-val price">₹{booking.total_amount}</span>
        </div>

        <div className="spec-item">
          <span className="spec-label">Status</span>
          <span className="spec-val">{booking.status}</span>
        </div>

        <div className="spec-item">
          <span className="spec-label">
            {isConfirmed ? "Confirmed At" : "Hold Expires In"}
          </span>
          <span className={`spec-val ${!isConfirmed ? "timer-countdown" : ""}`}>
            {isConfirmed
              ? new Date(booking.created_at).toLocaleTimeString()
              : formatCountdown(timeLeft)}
          </span>
        </div>
      </div>

      {/* Payment Action or Confirmation Banner */}
      <div className="payment-action-arena">
        {isConfirmed ? (
          <div className="payment-success-card">
            <div className="success-badge-circle">✓</div>
            <div className="success-text-group">
              <h4>Seats Permanently Confirmed</h4>
              <p>Your payment has been successfully recorded in PostgreSQL.</p>
              {payment?.provider_ref && (
                <div className="provider-ref-row">
                  <span className="ref-title">Provider Reference:</span>
                  <code className="ref-hash">{payment.provider_ref}</code>
                </div>
              )}
            </div>
            <button className="view-my-bookings-btn" onClick={onViewBookings}>
              View in My Bookings →
            </button>
          </div>
        ) : (
          <>
            {paymentError && (
              <div className="flow-error-banner payment-error" role="alert">
                <span className="error-sign">⚠️</span>
                <p>{paymentError}</p>
              </div>
            )}

            {booking.status === "pending" && (
              <button
                className="pay-now-action-btn"
                disabled={paymentLoading}
                onClick={onPay}
              >
                {paymentLoading ? (
                  <span className="btn-loading-flex">
                    <span className="spinner-micro" />
                    <span>Processing Payment Simulation...</span>
                  </span>
                ) : (
                  <span>Pay Now • ₹{booking.total_amount}</span>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
