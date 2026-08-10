import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { LocationProvide } from "./context/LocationContext.jsx";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SeatContextProvider } from "./context/SeatContext.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
    },
  },
});

createRoot(document.getElementById("root")).render(
    <Router>
      <QueryClientProvider client={queryClient}>
        <LocationProvide>
          <AuthProvider>
            <SeatContextProvider>
            <App />
            </SeatContextProvider>
          </AuthProvider>
        </LocationProvide>
      </QueryClientProvider>
    </Router>,
);
