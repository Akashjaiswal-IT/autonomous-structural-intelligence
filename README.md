# Clerk Authentication Demo

This repository includes:

- a Vite frontend in `frontend`
- a FastAPI backend in `backend`
- an optional protected Express example in `server`

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
2. Copy `frontend/.env.example` to `frontend/.env` and add your Clerk publishable key.
3. Copy `backend/.env.example` to `backend/.env` and add your `OPENAI_API_KEY`.
4. Optional: copy `server/.env.example` to `server/.env` if you want to run the Express Clerk example.
5. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. Run the FastAPI backend:

   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```

7. Optional: run the Express API:

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

## Environment Variables

Frontend (`frontend/.env`)

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=http://localhost:8787
VITE_PIPELINE_API_URL=http://127.0.0.1:8000
```

Backend (`backend/.env`)

```env
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai
```

Express example (`server/.env`)

```env
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
FRONTEND_URL=http://localhost:5173
PORT=8787
```

Push only the `.env.example` files to GitHub. Keep the real `.env` files local and add the same variables in your deployment platform's environment settings.

## Deployment Notes

- For local development, `VITE_API_URL` can point to the Express Clerk demo API and `VITE_PIPELINE_API_URL` can point to the FastAPI backend.
- For production, set both frontend env vars explicitly in your hosting platform.
- If your frontend and backend are served from the same origin in production, the frontend now falls back to the current site origin when these vars are not set.
