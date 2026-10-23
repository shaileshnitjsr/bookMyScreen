-- Migration: 004_curate_demo_catalogue.sql
-- Description: Curate blockbuster movie catalogue and generate valid upcoming showtimes and seats.

INSERT INTO movies (title, description, duration_minutes, language)
VALUES
  ('Oppenheimer', 'The story of J. Robert Oppenheimer’s role in the development of the atomic bomb.', 180, 'English'),
  ('Top Gun: Maverick', 'Pete Mitchell pushes the envelope as a courageous test pilot confronting the ghosts of his past.', 130, 'English'),
  ('Spider-Man: Across the Spider-Verse', 'Miles Morales catapults across the Multiverse to encounter a team of Spider-People.', 140, 'English'),
  ('Avatar: The Way of Water', 'Jake Sully lives with his newfound family on the extrasolar moon Pandora.', 192, 'English'),
  ('The Dark Knight', 'Batman faces the Joker, a criminal mastermind who seeks to plunge Gotham City into anarchy.', 152, 'English'),
  ('Avengers: Endgame', 'The remaining Avengers assemble once more in order to reverse Thanos’ actions.', 181, 'English')
ON CONFLICT DO NOTHING;

-- Generate upcoming showtimes for newly added movies
INSERT INTO shows (movie_id, screen_id, starts_at, ends_at)
SELECT m.id, 1, NOW() + INTERVAL '4 days' + (m.id * INTERVAL '3 hours'), NOW() + INTERVAL '4 days' + (m.id * INTERVAL '3 hours') + (m.duration_minutes * INTERVAL '1 minute')
FROM movies m
WHERE NOT EXISTS (
    SELECT 1 FROM shows s WHERE s.movie_id = m.id AND s.starts_at > NOW()
);

-- Generate show_seats for the new shows
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT sh.id, st.id, 220.00, 'available'
FROM shows sh
CROSS JOIN seats st
WHERE st.screen_id = sh.screen_id
  AND NOT EXISTS (
      SELECT 1 FROM show_seats ss WHERE ss.show_id = sh.id AND ss.seat_id = st.id
  );
