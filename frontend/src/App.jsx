import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import MovieRow from "./components/MovieRow";
import MovieDetailsModal from "./components/MovieDetailsModal";
import ShowtimeSelection from "./components/ShowtimeSelection";
import SeatSelection from "./components/SeatSelection";
import PaymentConfirmation from "./components/PaymentConfirmation";
import MyBookingsView from "./components/MyBookingsView";
import { buildMovieRows, getMovieMeta } from "./data/movieMetadata";
import "./App.css";

const MY_LIST_STORAGE_KEY = "cineflow_mylist_user1";

export default function App() {
  // Navigation & View state
  const [currentView, setCurrentView] = useState("browse"); // "browse" | "movies-all" | "my-list" | "my-bookings"
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("All");

  // Movie catalog state
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [featuredMovie, setFeaturedMovie] = useState(null);
  const [detailsModalMovie, setDetailsModalMovie] = useState(null);

  // My List (persistent saved movies)
  const [myListIds, setMyListIds] = useState(() => {
    try {
      const saved = localStorage.getItem(MY_LIST_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ["3", "5", "6"]; // Default seed with Dune, Oppenheimer, Top Gun
    } catch {
      return ["3", "5"];
    }
  });

  // Booking Flow: Showtimes & Seats
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [showsLoading, setShowsLoading] = useState(false);
  const [showsError, setShowsError] = useState("");

  const [selectedShow, setSelectedShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [seatsError, setSeatsError] = useState("");

  // Reservation & Payment state
  const [booking, setBooking] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const [payment, setPayment] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // User Bookings History
  const [userBookings, setUserBookings] = useState([]);
  const [userBookingsLoading, setUserBookingsLoading] = useState(false);
  const [userBookingsError, setUserBookingsError] = useState("");

  // Countdown timer for pending reservation
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Load catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch("http://localhost:3000/api/movies");
        if (!response.ok) {
          throw new Error("Failed to connect to CineFlow catalog service");
        }
        const data = await response.json();
        const catalog = data.movies || [];
        setMovies(catalog);

        if (catalog.length > 0) {
          // Default featured to Dune: Part Two or Oppenheimer
          const defaultHero =
            catalog.find((m) => m.title === "Dune: Part Two") || catalog[0];
          setFeaturedMovie(defaultHero);
        }
      } catch (err) {
        setError(err.message || "Failed to load movie collection");
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, []);

  // Update localStorage when My List changes
  const toggleMyList = useCallback((movieId) => {
    const strId = String(movieId);
    setMyListIds((prev) => {
      let updated;
      if (prev.includes(strId)) {
        updated = prev.filter((id) => id !== strId);
      } else {
        updated = [...prev, strId];
      }
      try {
        localStorage.setItem(MY_LIST_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage quota errors
      }
      return updated;
    });
  }, []);

  const isSavedInList = useCallback(
    (movieId) => {
      return myListIds.includes(String(movieId));
    },
    [myListIds]
  );

  // Reservation expiry countdown timer
  useEffect(() => {
    if (!booking || booking.status !== "pending" || !booking.expires_at) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [booking]);

  const timeLeft = useMemo(() => {
    if (!booking || booking.status !== "pending" || !booking.expires_at) {
      return null;
    }
    const expiryTime = new Date(booking.expires_at).getTime();
    return Math.max(0, Math.floor((expiryTime - currentTime) / 1000));
  }, [booking, currentTime]);

  // Load user bookings from real PostgreSQL endpoint
  const loadUserBookings = useCallback(async () => {
    setUserBookingsLoading(true);
    setUserBookingsError("");
    try {
      const response = await fetch("http://localhost:3000/api/bookings/user/1");
      if (!response.ok) {
        throw new Error("Failed to load user booking records");
      }
      const data = await response.json();
      setUserBookings(data.bookings || []);
    } catch (err) {
      setUserBookingsError(err.message || "Could not fetch bookings");
    } finally {
      setUserBookingsLoading(false);
    }
  }, []);

  const handleNavigate = (view) => {
    setCurrentView(view);
    setSelectedMovie(null);
    setSelectedShow(null);
    setBooking(null);
    setPayment(null);

    if (view === "my-bookings") {
      loadUserBookings();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Start booking flow for a movie
  const handleInitiateBooking = async (movie) => {
    setSelectedMovie(movie);
    setSelectedShow(null);
    setShows([]);
    setShowsError("");
    setSelectedSeats([]);
    setBooking(null);
    setBookingError("");
    setPayment(null);
    setPaymentError("");
    setShowsLoading(true);

    try {
      const response = await fetch(`http://localhost:3000/api/shows/${movie.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch upcoming showtimes");
      }
      const data = await response.json();
      setShows(data.shows || []);
    } catch (err) {
      setShowsError(err.message || "Could not retrieve showtimes");
    } finally {
      setShowsLoading(false);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Select a showtime and load seat map
  const handleSelectShow = async (show) => {
    setSelectedShow(show);
    setSeats([]);
    setSelectedSeats([]);
    setSeatsError("");
    setBooking(null);
    setBookingError("");
    setPayment(null);
    setPaymentError("");
    setSeatsLoading(true);

    try {
      const response = await fetch(
        `http://localhost:3000/api/shows/${show.show_id}/seats`
      );
      if (!response.ok) {
        throw new Error("Failed to load screen seating layout");
      }
      const data = await response.json();
      setSeats(data.seats || []);
    } catch (err) {
      setSeatsError(err.message || "Could not retrieve seating layout");
    } finally {
      setSeatsLoading(false);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleSeat = (seat) => {
    if (seat.status !== "available") return;
    if (bookingError) setBookingError("");

    setSelectedSeats((prev) => {
      if (prev.includes(seat.seat_id)) {
        return prev.filter((id) => id !== seat.seat_id);
      }
      return [...prev, seat.seat_id];
    });
  };

  // Reserve selected seats via POST /api/bookings
  const handleReserveSeats = async () => {
    if (!selectedShow || selectedSeats.length === 0 || bookingLoading) return;

    setBookingLoading(true);
    setBookingError("");
    setBooking(null);
    setPayment(null);
    setPaymentError("");

    try {
      const response = await fetch("http://localhost:3000/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: 1,
          showId: selectedShow.show_id,
          seatIds: selectedSeats,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data?.message ||
          (response.status === 409
            ? "One or more of your chosen seats were just reserved by another guest. Please select different seats."
            : response.status === 400
            ? "Invalid booking request. Please check your seat selection."
            : response.status >= 500
            ? "Server transaction error. Please try again."
            : `Booking failed with status ${response.status}`);
        throw new Error(message);
      }

      setBooking(data.booking);
    } catch (err) {
      if (err.name === "TypeError" || err.message === "Failed to fetch") {
        setBookingError("Network connection error. Please verify your server connection.");
      } else {
        setBookingError(err.message || "An unexpected booking error occurred.");
      }
    } finally {
      setBookingLoading(false);
    }
  };

  // Simulate payment via POST /api/payments
  const handleProcessPayment = async () => {
    if (!booking || paymentLoading) return;

    setPaymentLoading(true);
    setPaymentError("");

    try {
      const idempotencyKey = `pay_${booking.id}_${Date.now()}`;
      const response = await fetch("http://localhost:3000/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          idempotencyKey,
          simulationOutcome: "success",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message || `Payment transaction rejected (${response.status})`
        );
      }

      setPayment(data.payment);
      if (data.booking) {
        setBooking(data.booking);
      }
    } catch (err) {
      setPaymentError(
        err.message || "Payment simulation failed. Please try again."
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  // Supported languages
  const languages = useMemo(() => {
    return ["All", ...new Set(movies.map((m) => m.language).filter(Boolean))];
  }, [movies]);

  // Filtered movies based on language & search
  const filteredMovies = useMemo(() => {
    return movies.filter((m) => {
      const meta = getMovieMeta(m.title);
      const matchesSearch =
        !search ||
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        meta.genre.toLowerCase().includes(search.toLowerCase()) ||
        meta.director.toLowerCase().includes(search.toLowerCase());

      const matchesLang = language === "All" || m.language === language;
      return matchesSearch && matchesLang;
    });
  }, [movies, search, language]);

  // Movies in My List
  const myListMovies = useMemo(() => {
    return movies.filter((m) => myListIds.includes(String(m.id)));
  }, [movies, myListIds]);

  // Horizontal movie rows for Netflix browsing
  const contentRows = useMemo(() => {
    const baseRows = buildMovieRows(filteredMovies);

    // If viewing standard browsing and user has movies in My List, prepend a "My List" row
    if (myListMovies.length > 0 && !search && currentView === "browse") {
      return [
        {
          id: "user-my-list-row",
          title: "My List — Saved for Later",
          movies: myListMovies,
        },
        ...baseRows,
      ];
    }
    return baseRows;
  }, [filteredMovies, myListMovies, search, currentView]);

  return (
    <div className="cineflow-netflix-root">
      {/* Sticky Netflix Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        search={search}
        onSearchChange={setSearch}
        language={language}
        onLanguageChange={setLanguage}
        languages={languages}
        myListCount={myListIds.length}
      />

      <main className="cineflow-netflix-main">
        {/* If booking subflow is active */}
        {selectedShow ? (
          <div className="booking-subview-wrapper">
            <SeatSelection
              movie={selectedMovie}
              show={selectedShow}
              seats={seats}
              selectedSeats={selectedSeats}
              seatsLoading={seatsLoading}
              seatsError={seatsError}
              onToggleSeat={handleToggleSeat}
              onBookSeats={handleReserveSeats}
              bookingLoading={bookingLoading}
              bookingError={bookingError}
              onBack={() => {
                setSelectedShow(null);
                setSelectedSeats([]);
                setBooking(null);
                setBookingError("");
                setPayment(null);
                setPaymentError("");
              }}
            />

            {booking && (
              <PaymentConfirmation
                booking={booking}
                payment={payment}
                paymentLoading={paymentLoading}
                paymentError={paymentError}
                onPay={handleProcessPayment}
                onViewBookings={() => handleNavigate("my-bookings")}
                timeLeft={timeLeft}
              />
            )}
          </div>
        ) : selectedMovie ? (
          <ShowtimeSelection
            movie={selectedMovie}
            shows={shows}
            showsLoading={showsLoading}
            showsError={showsError}
            onSelectShow={handleSelectShow}
            onBack={() => {
              setSelectedMovie(null);
              setShows([]);
              setShowsError("");
            }}
          />
        ) : currentView === "my-bookings" ? (
          <MyBookingsView
            bookings={userBookings}
            loading={userBookingsLoading}
            error={userBookingsError}
            onRefresh={loadUserBookings}
            onBrowseMovies={() => setCurrentView("browse")}
          />
        ) : currentView === "my-list" ? (
          /* Dedicated My List View */
          <section className="dedicated-list-view">
            <div className="dedicated-list-header">
              <span className="header-stage-tag">SAVED TITLES</span>
              <h2 className="dedicated-list-title">My List</h2>
              <p className="dedicated-list-subtitle">
                Movies you have saved to book tickets for upcoming screenings
              </p>
            </div>

            {myListMovies.length === 0 ? (
              <div className="flow-empty-box">
                <span className="empty-ticket-glyph">📑</span>
                <h3>Your list is empty</h3>
                <p>Explore movies and click the "+" icon to add them to your personal watchlist.</p>
                <button
                  className="empty-browse-btn"
                  onClick={() => setCurrentView("browse")}
                >
                  Explore Movies
                </button>
              </div>
            ) : (
              <div className="my-list-full-grid">
                {myListMovies.map((m, idx) => (
                  <div key={m.id} className="my-list-grid-item">
                    <MovieRow
                      title=""
                      movies={[m]}
                      onBookClick={handleInitiateBooking}
                      onMoreInfoClick={setDetailsModalMovie}
                      isSavedInList={isSavedInList}
                      onToggleMyList={toggleMyList}
                      key={`${m.id}-${idx}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* Primary Netflix Browsing Mode (Hero + Horizontal Content Rows) */
          <>
            {/* Search Results Mode */}
            {search ? (
              <section className="search-results-section">
                <div className="search-results-header">
                  <h2 className="search-results-title">
                    Search Results for <span className="highlight-query">“{search}”</span>
                  </h2>
                  <span className="search-count-badge">
                    {filteredMovies.length} title{filteredMovies.length === 1 ? "" : "s"} found
                  </span>
                </div>

                {filteredMovies.length === 0 ? (
                  <div className="flow-empty-box">
                    <span className="empty-ticket-glyph">🔍</span>
                    <h3>No matching titles found</h3>
                    <p>Try searching for a different movie title, genre, or director.</p>
                    <button
                      className="empty-browse-btn"
                      onClick={() => setSearch("")}
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <MovieRow
                    title="Matching Titles"
                    movies={filteredMovies}
                    onBookClick={handleInitiateBooking}
                    onMoreInfoClick={setDetailsModalMovie}
                    isSavedInList={isSavedInList}
                    onToggleMyList={toggleMyList}
                  />
                )}
              </section>
            ) : (
              <>
                {/* Full-width Cinematic Hero */}
                <Hero
                  featuredMovie={featuredMovie}
                  allMovies={movies}
                  onBookClick={handleInitiateBooking}
                  onMoreInfoClick={setDetailsModalMovie}
                  onSelectFeatured={setFeaturedMovie}
                  isSavedInList={isSavedInList}
                  onToggleMyList={toggleMyList}
                />

                {/* Horizontal Content Carousels */}
                <div className="netflix-content-rows-container">
                  {loading && (
                    <div className="flow-loading-box">
                      <div className="flow-spinner" />
                      <p>Loading cinema showcase...</p>
                    </div>
                  )}

                  {error && (
                    <div className="flow-error-banner" role="alert">
                      <p>{error}</p>
                    </div>
                  )}

                  {!loading &&
                    !error &&
                    contentRows.map((row) => (
                      <MovieRow
                        key={row.id}
                        title={row.title}
                        movies={row.movies}
                        onBookClick={handleInitiateBooking}
                        onMoreInfoClick={setDetailsModalMovie}
                        isSavedInList={isSavedInList}
                        onToggleMyList={toggleMyList}
                      />
                    ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Netflix-Style Movie Details Modal */}
      {detailsModalMovie && (
        <MovieDetailsModal
          movie={detailsModalMovie}
          onClose={() => setDetailsModalMovie(null)}
          onBookClick={handleInitiateBooking}
          isSavedInList={isSavedInList}
          onToggleMyList={toggleMyList}
        />
      )}

      {/* Footer */}
      <footer className="netflix-footer">
        <div className="footer-inner-bounds">
          <div className="footer-brand-mark">
            <span className="brand-wordmark">
              CINE<span className="brand-accent">FLOW</span>
            </span>
            <p className="footer-blurb">
              The premium desktop movie-discovery and seat-reservation platform.
            </p>
          </div>

          <div className="footer-links-grid">
            <div className="footer-col">
              <button className="footer-text-link" onClick={() => handleNavigate("browse")}>
                Browse All Shows
              </button>
              <button className="footer-text-link" onClick={() => handleNavigate("my-list")}>
                My Watchlist
              </button>
            </div>
            <div className="footer-col">
              <button className="footer-text-link" onClick={() => handleNavigate("my-bookings")}>
                Transaction Receipts
              </button>
              <span className="footer-note">Dolby Atmos & IMAX Certified</span>
            </div>
          </div>

          <div className="footer-legal-bar">
            <span>© {new Date().getFullYear()} CineFlow Entertainment Inc. All rights reserved.</span>
            <span className="legal-security-tag">PCI-DSS Simulated Secure Checkout</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
