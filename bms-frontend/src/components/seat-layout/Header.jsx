import React from "react";
import mainLogo from "../../assets/main-icon.png";
import { Navigate, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { FaUser } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

dayjs.extend(customParseFormat);

const Header = ({ showData, type }) => {
  const navigate = useNavigate();
  const { auth, user, toggleModal } = useAuth();
  console.log(showData)
  return (
    <>
      <div className="border-b border-gray-200 shadow-sm bg-white">
        {/* Top Bar */}
        <div className="flex items-center justify-between py-4 px-6">
          {/* Logo */}
          <img
            onClick={() => navigate("/")}
            src={mainLogo}
            alt="bookMyScreen"
            className="h-6 md:h-8 object-contain cursor-pointer"
          />

          {type === "checkout" ? (
            <div>
              <h2 className="font-bold text-gray-900 text-lg md:text-xl">
                Review your booking
              </h2>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="font-bold text-lg md:text-xl">
                {showData?.movie.title}
              </h2>
              <p className="text-xs text-gray-500 font-semibold">
                {dayjs(showData?.date, "DD-MM-YYYY").format("D MMMM YYYY")} &nbsp;
                {showData?.startTime} at{" "}
                {showData?.theater.name +
                  ", " +
                  showData?.theater.city +
                  ", " +
                  showData?.theater.state}
              </p>
            </div>
          )}

          {auth ? (
            <>
              <div className="flex items-center gap-6">
                <span className="cursor-pointer text-sm font-medium border rounded-full border-gray-300 p-2">
                  <FaUser className="text-gray-500" />
                </span>
                <span
                  onClick={() => navigate(`/profile/${user?._id}/profile`)}
                  className="text-sm -ml-3 font-normal cursor-pointer hover:text-red-500"
                >
                  Hi, {user ? user?.name : "Test User"} &nbsp; ▼
                </span>
              </div>
            </>
          ) : (
            <button
              onClick={() => toggleModal()}
              className="bg-[#f84464] cursor-pointer
                                    text-white px-4 py-1.5 rounded text-sm"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
      {/* Show Timings */}
      {type !== "checkout" && (
        <>
          <div className="bg-white pt-4">
            <div className="mx-auto px-6 pb-4 flex items-center gap-4 max-w-7xl">
              <div className="text-sm text-gray-700">
                <p className="text-xs text-gray-500 font-medium">
                  {dayjs(showData?.date, "DD-MM-YYYY").format("ddd")}
                </p>
                <p className="text-sm font-semibold text-gray-700">
                  {dayjs(showData?.date, "DD-MM-YYYY").format("DD MMMM")}
                </p>
              </div>

              <button
                className={`border cursor-pointer rounded-[14px] px-8 py-3 text-sm border-black font-medium bg-gray-200
            `}
              >
                {showData?.startTime}
                <p className="text-[10px] text-gray-500 -mt-1">
                  {showData?.audioType.toUpperCase()}
                </p>
              </button>
            </div>
          </div>
          <hr className="my-2 border-gray-300 max-w-7xl mx-auto" />
        </>
      )}
    </>
  );
};

export default Header;
