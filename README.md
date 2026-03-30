# Clerk Authentication Demo

This repository now includes a production-style Clerk authentication frontend in [`frontend`](/Users/akashsmac/Desktop/try/autonomous-structural-intelligence/frontend) and an optional protected Express example in [`server`](/Users/akashsmac/Desktop/try/autonomous-structural-intelligence/server).

## Frontend

Features included:

- Clerk sign up, sign in, sign out
- Email verification and password reset through Clerk hosted flows
- Protected routes for `/dashboard` and `/profile`
- Responsive dark glassmorphism UI built with Tailwind CSS
- Navbar that switches between guest actions and Clerk `UserButton`
- Dashboard API example using Clerk session tokens
- Clerk `UserProfile` for account and session management

## Setup

1. Create a Clerk application and enable the email/password strategy.
2. Copy [`frontend/.env.example`](/Users/akashsmac/Desktop/try/autonomous-structural-intelligence/frontend/.env.example) to `frontend/.env` and add your publishable key.
3. Optional: copy [`server/.env.example`](/Users/akashsmac/Desktop/try/autonomous-structural-intelligence/server/.env.example) to `server/.env` and add your Clerk secret key.
4. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Optional: run the Express API:

   ```bash
   cd server
   npm install
   npm run dev
   ```

## Routes

- `/sign-in`
- `/sign-up`
- `/dashboard`
- `/profile`

If the Express API is not running, the dashboard still renders and shows a graceful warning for the protected API card.
