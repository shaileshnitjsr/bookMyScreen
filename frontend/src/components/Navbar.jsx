import { useState, useEffect, useRef } from "react";

export default function Navbar({
  currentView,
  onNavigate,
  search,
  onSearchChange,
  language,
  onLanguageChange,
  languages,
  myListCount = 0,
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearchToggle = () => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else if (!search) {
      setIsSearchOpen(false);
    }
  };

  const handleClearSearch = () => {
    onSearchChange("");
    setIsSearchOpen(false);
  };

  return (
    <header className={`netflix-navbar-header ${isScrolled ? "scrolled" : ""}`}>
      <nav className="netflix-navbar">
        <div className="navbar-left-group">
          <button
            className="navbar-brand"
            onClick={() => onNavigate("browse")}
            aria-label="CineFlow Home"
          >
            <span className="brand-symbol">▶</span>
            <span className="brand-wordmark">
              CINE<span className="brand-accent">FLOW</span>
            </span>
          </button>

          <ul className="navbar-navigation-list">
            <li>
              <button
                className={`nav-tab-btn ${currentView === "browse" && !search ? "active" : ""}`}
                onClick={() => onNavigate("browse")}
              >
                Home
              </button>
            </li>
            <li>
              <button
                className={`nav-tab-btn ${currentView === "movies-all" ? "active" : ""}`}
                onClick={() => onNavigate("movies-all")}
              >
                Movies
              </button>
            </li>
            <li>
              <button
                className={`nav-tab-btn ${currentView === "my-list" ? "active" : ""}`}
                onClick={() => onNavigate("my-list")}
              >
                My List
                {myListCount > 0 && (
                  <span className="nav-counter-pill">{myListCount}</span>
                )}
              </button>
            </li>
            <li>
              <button
                className={`nav-tab-btn ${currentView === "my-bookings" ? "active" : ""}`}
                onClick={() => onNavigate("my-bookings")}
              >
                My Bookings
              </button>
            </li>
          </ul>
        </div>

        <div className="navbar-right-group">
          {/* Expandable Search Input */}
          <div
            className={`navbar-search-box ${isSearchOpen || search ? "expanded" : ""}`}
          >
            <button
              className="search-trigger-btn"
              onClick={handleSearchToggle}
              aria-label="Open search"
            >
              <svg
                className="search-svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            <input
              ref={searchInputRef}
              type="text"
              placeholder="Titles, genres, directors..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="search-text-input"
              aria-label="Search movies"
            />

            {search && (
              <button
                className="search-clear-action"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Language selector */}
          {languages && languages.length > 1 && (
            <div className="navbar-lang-wrapper">
              <select
                className="navbar-lang-select"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                aria-label="Select audio language"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang === "All" ? "All Languages" : lang}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User Profile Pill */}
          <div className="navbar-profile-pill" title="Demo User Profile">
            <div className="profile-avatar-box">
              <span className="avatar-initials">U1</span>
            </div>
            <span className="profile-name">User #1</span>
          </div>
        </div>
      </nav>
    </header>
  );
}
