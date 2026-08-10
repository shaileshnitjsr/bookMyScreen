import mongoose, { ClientSession, mongo, Types } from "mongoose";
import { generateSeatLayout, groupShowsByTheatreAndMovie } from "../../utils";
import { IShow } from "./show.interface";
import { ShowModel } from "./show.model";

//1. Create a show
export const createShow = async (showData: IShow) => {
  const seatLayout = generateSeatLayout();
  const showToCreate = { ...showData, seatLayout };

  return await ShowModel.create(showToCreate);
};
//2. get shows by movie date and location
export const getShowsByMovieDateLocation = async (
  movieId: string,
  date: string,
  location: string
) => {
  const query: any = {
    movie: new Types.ObjectId(movieId),
    location: { $regex: new RegExp(location, "i") },
  };

  if (date) {
    query.date = date;
  }

  const shows = await ShowModel.find(query)
    .populate("movie theater")
    .sort({ startTime: 1 });

  const groupedShows = groupShowsByTheatreAndMovie(shows);

  return groupedShows;
};
//3. get show by id
export const getShowById = async (showId: string) => {
  return await ShowModel.findById(showId).populate("movie theater");
};

//4. update seat status
export const updateSeatStatus = async (
  showId: mongoose.Types.ObjectId,
  seats: string[],
  status: "AVAILABLE" | "BOOKED" | "BLOCKED",
  session: ClientSession
) => {
  
  const show = await ShowModel.findById(showId).session(session);
  if(!show) {
    throw new Error(`Show not found!`)
  }

  // Parse each seat string like "A1" into row and number
  const parsedSeats = seats.map((seat) => {
    const row = seat.charAt(0);
    const number = parseInt(seat.slice(1));
    return { row, number };
  });


  // Update the seat layout based on the parsed seats

  for(const parsedSeat of parsedSeats) {

    // Search the seatLayout array for a row whose "row" field matches e.g. "A1"
    // seatLayout = [{ row: "A", seats: [...] }, { row: "B", seats: [...] }]
    const row = show.seatLayout.find((r) => r.row === parsedSeat.row);

    if(!row) {
      throw new Error(`Invalid seat row: ${parsedSeat.row}`);
    }

    // Inside the found row, search the seats array for matching seat number
    // row.seats = [{ number: 1, status: "AVAILABLE" }, { number: 2, status: "AVAILABLE" }]
    const seat = row.seats.find((s) => s.number === parsedSeat.number);

    if(!seat) {
      throw new Error(`Invalid seat number: ${parsedSeat.number} in row ${parsedSeat.row}`);
    }

    // Guard: prevent double booking — if already BOOKED, reject the whole transaction
    if(seat.status === "BOOKED") {
      throw new Error(`Seat ${parsedSeat.row}${parsedSeat.number} is already booked!`);
    }

    seat.status = status; // Update the seat status to BOOKED or BLOCKED

  }

  show.markModified("seatLayout"); // Inform Mongoose that seatLayout has been modified

  await show.save({ session }); // Save the updated show document within the transaction session

}


