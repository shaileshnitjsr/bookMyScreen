-- 003_payments_and_outbox.sql
-- Create payments and outbox_events tables with constraints and indexes

-- 1. Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'requires_reconciliation')),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    provider_ref VARCHAR(100) UNIQUE,
    payment_method VARCHAR(50) DEFAULT 'simulated_card',
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id
    ON payments(booking_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(status);

-- 2. Add updated_at to bookings if it does not exist
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Create outbox_events table
CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id BIGINT NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created
    ON outbox_events(status, created_at)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate
    ON outbox_events(aggregate_type, aggregate_id);
