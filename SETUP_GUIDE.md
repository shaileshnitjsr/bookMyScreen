# Movie Booking System -- Setup Guide

## Step 1: Install MongoDB & MongoDB Compass

First, make sure **MongoDB** and **MongoDB Compass** are installed on
your system.

1.  Install MongoDB
2.  Open MongoDB Compass
3.  Start a local connection

Connection URL:

    mongodb://localhost:27017/bookmyscreen

------------------------------------------------------------------------

## Step 2: Environment Variables Setup (Backend)

Create a `.env` file inside the backend project and add the following
variables:

    PORT=9000
    MONGO_CONNECTION_STRING=mongodb://localhost:27017/bookmyscreen
    NODEMAILER_EMAIL=
    NODEMAILER_PASSWORD=
    HASH_SECRET=
    ACCESS_TOKEN_SECRET=
    REFRESH_TOKEN_SECRET=
    FRONTEND_URL=

👉 Copy the MongoDB connection URL from Compass and paste it here if
needed.

------------------------------------------------------------------------

## Step 3: Install Dependencies (IMPORTANT)

Before running anything, install project dependencies.

### Backend

    npm install

### Frontend

Navigate to frontend folder and run:

    npm install

------------------------------------------------------------------------

## Step 4: Seed Initial Data

Movies, Theaters, and Shows seeders are already created.

Run the following commands inside the backend folder:

    npm run seed:movies
    npm run seed:theater
    npm run seed:shows

These commands will insert required initial data into the database.

------------------------------------------------------------------------

## Step 5: Start Backend Server

Run:

    npm run dev

Backend server will start at:

    http://localhost:9000

------------------------------------------------------------------------

## Step 6: Start Frontend Server

Go to the frontend folder and run:

    npm run dev

Frontend application will start at:

    http://localhost:5173

------------------------------------------------------------------------

## ✅ Project Ready

Your Movie Booking System is now successfully running.

Open in browser: - Frontend → http://localhost:5173 - Backend →
http://localhost:9000
Updated setup instructions.
