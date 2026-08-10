import { createContext, useContext, useState } from "react";

const SeatContext = createContext();

export const SeatContextProvider = ({ children }) => {

    const [shows, setShows] = useState(null);
    const [selectedSeats, setSelectedSeats] = useState([]);

    return (
        <SeatContext.Provider value={{ shows, setShows, selectedSeats, setSelectedSeats }}>
            {children}
        </SeatContext.Provider>
    );
}

export const useSeatContext = () => useContext(SeatContext);