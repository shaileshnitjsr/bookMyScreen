import React from 'react'

const Seat = ({key, seat, row}) => {
    const seatId = `${row}${seat.number}`;
  return (
    <button key={key} className={`w-9 h-9 m-[2px] rounded-lg border text-sm hover:bg-gray-100 border-black cursor-pointer`}>
        {seat.status === "occupied" ? "X"  : seat.number}
    </button>
  )
}

export default Seat