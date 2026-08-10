import { axiosWrapper } from "./axiosWrapper";

// List all the endpoints;
export const getRecommendedMovies = () =>
  axiosWrapper.get("/movies/recommended");
export const getAllMovies = () => axiosWrapper.get("/movies");
export const getMovieById = (data) => axiosWrapper.get(`/movies/${data}`);
export const getShowsByMovieAndLocation = (movieId, state, date) =>
  axiosWrapper.get("/shows", {
    params: {
      movieId,
      state,
      date,
    },
  });
export const getShowById = (data) => axiosWrapper.get(`/shows/${data}`);

// Authentication APIS
export const sendOTP = (data) => axiosWrapper.post("/auth/send-otp", data);
export const verifyOTP = (data) => axiosWrapper.post("/auth/verify-otp", data);
export const activate = ({ id, ...data }) =>
  axiosWrapper.put(`/users/activate/${id}`, data);
export const logout = () => axiosWrapper.post("/auth/logout");
export const getUser = () => axiosWrapper.get("/users/me");


// Payment Endpoints
export const createOrderRazorpay = (data) => axiosWrapper.post("/payment/create-order", data);
export const verifyPaymentRazorpay = (data) => axiosWrapper.post("/payment/verify-payment", data);

// Booking Endpoints
export const bookShow = (data) => axiosWrapper.post("/book", data);
export const getUserBookings = () => axiosWrapper.get("/book");

// Interceptor

axiosWrapper.interceptors.response.use(
  (config) => {
    return config;
  },
  async (error) => {
    const originalRequest = error.config;
    console.log(originalRequest);
    if (
      error.response &&
      error.response.status === 401 &&
      originalRequest &&
      !originalRequest._isRetry &&
      !originalRequest.url.includes("/auth/refresh-token")
    ) {
      originalRequest._isRetry = true;

      try {
        await axiosWrapper.get("/auth/refresh-token");

        return axiosWrapper.request(originalRequest);
      } catch (error) {
        console.log("Error while refreshing the token", error);
      }
    }

    throw error;
  },
);
