-- 002_constraints_and_indexes.sql
-- Add constraints and indexes for concurrency and consistency

-- 1. Index on show_seats(booking_id) to optimize booking lookups and expiry updates
CREATE INDEX IF NOT EXISTS idx_show_seats_booking_id
    ON show_seats(booking_id);

-- 2. Index on bookings(status, expires_at) to optimize expired pending booking lookups
CREATE INDEX IF NOT EXISTS idx_bookings_status_expires_at
    ON bookings(status, expires_at);

-- 3. Consistency check: available seats must have NULL booking_id,
-- and reserved/booked seats must have a non-NULL booking_id.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'show_seats_booking_ownership_check'
    ) THEN
        ALTER TABLE show_seats
        ADD CONSTRAINT show_seats_booking_ownership_check
        CHECK (
            (status = 'available' AND booking_id IS NULL) OR
            (status IN ('reserved', 'booked') AND booking_id IS NOT NULL)
        );
    END IF;
END $$;
