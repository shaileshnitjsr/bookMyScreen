CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE movies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    language VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE theatres (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL
);

CREATE TABLE screens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    theatre_id BIGINT NOT NULL REFERENCES theatres(id),
    name VARCHAR(100) NOT NULL,
    UNIQUE (theatre_id, name)
);

CREATE TABLE seats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    screen_id BIGINT NOT NULL REFERENCES screens(id),
    row_label VARCHAR(5) NOT NULL,
    seat_number INT NOT NULL CHECK (seat_number > 0),
    UNIQUE (screen_id, row_label, seat_number)
);

CREATE TABLE shows (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movie_id BIGINT NOT NULL REFERENCES movies(id),
    screen_id BIGINT NOT NULL REFERENCES screens(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    CHECK (ends_at > starts_at)
);

CREATE TABLE show_seats (
    show_id BIGINT NOT NULL REFERENCES shows(id),
    seat_id BIGINT NOT NULL REFERENCES seats(id),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'reserved', 'booked')),
    PRIMARY KEY (show_id, seat_id)
);

CREATE TABLE bookings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    show_id BIGINT NOT NULL REFERENCES shows(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_seats (
    booking_id BIGINT NOT NULL REFERENCES bookings(id),
    show_id BIGINT NOT NULL,
    seat_id BIGINT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    PRIMARY KEY (booking_id, seat_id),
    FOREIGN KEY (show_id, seat_id)
        REFERENCES show_seats(show_id, seat_id)
);

CREATE INDEX idx_shows_movie_start
    ON shows(movie_id, starts_at);

CREATE INDEX idx_bookings_user_created
    ON bookings(user_id, created_at DESC);

CREATE INDEX idx_show_seats_status
    ON show_seats(show_id, status);
