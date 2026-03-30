Project Name: Autonomous Structural Intelligence

A full-stack decentralized application (dApp) built on the Stellar blockchain. Users can use this dApp to generate 3D models from floor-plan uploads and also get suggestions for materials to be used to build the building with cost and quality description. The system assigns unique IDs to each pipeline run and persisted analysis, and those registered analyses can be opened again using their respective job and analysis IDs.

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
# Autonomous Structural Intelligence

**Turn a 2D floor plan into a 3D structural model, material recommendations, and plain-English explanations—then anchor a hash of the analysis on Stellar testnet.**

A full-stack hackathon project that combines computer vision, computational geometry, rule-based material scoring, LLM explainability, and optional blockchain attestation behind a polished React + Three.js workspace with Clerk authentication.

## The problem
Architects and builders often work from raster floor plans (PDF exports, scans, screenshots). Turning those into a consistent 3D layout, sensible structural assumptions, and defensible material choices usually means multiple tools and manual rework. This project automates that path from **image → geometry → 3D → materials → narrative report**, with progress streaming to the UI and an optional on-chain fingerprint for demos.
---
## What we built
| Capability | Description |
|------------|-------------|
| **Floor plan ingestion** | Upload PNG/JPEG; OpenCV (Canny + Hough) extracts wall segments, junctions, and openings. |
| **2D → 3D** | Shapely-based reconstruction; walls extruded in a Three.js-ready payload; load-bearing vs partition classification. |
| **Material intelligence** | Weighted tradeoffs (e.g. strength vs durability vs cost) with different emphasis for load-bearing vs partition elements. |
| **Explainability** | Structured report via OpenAI or Anthropic APIs, with template fallback if no API key is set. |
| **Verification** | Cross-check between parsed image features and generated 3D metadata (`verify_generated_model`). |
| **Live progress** | WebSocket `/ws/pipeline/{job_id}` streams stage updates during `/api/pipeline`. |
| **Draw mode** | Author geometry in the browser (2D→3D studio) with persisted draw/conversion history via FastAPI. |
| **Blockchain hook** | Stellar testnet: SHA-256 digest of key analysis fields logged in a transaction memo ([`frontend/src/stellar/integration.js`](frontend/src/stellar/integration.js)). |
| **Accounts** | Clerk powers sign-in, protected `/dashboard` (structural workspace) and `/profile`. |


- **Frontend** (`frontend/`): React 19, Vite, Tailwind, React Three Fiber, axios to the Express app for Clerk-protected routes.
- **Structural API** (`backend/`): FastAPI; primary entry `POST /api/pipeline`. The dashboard calls `http://localhost:8000` for analysis (see [`FloorPlanUpload.jsx`](frontend/src/components/FloorPlanUpload.jsx)).
- **Auth API** (`server/`): Express + `@clerk/express` for `/api/protected` and CORS aligned with the Vite dev URL.

## Tech stack
- **UI:** React, Vite, Tailwind CSS, Three.js, `@react-three/fiber`, `@react-three/drei`
- **Auth:** Clerk (React + Express middleware)
- **Backend:** Python 3, FastAPI, Uvicorn, OpenCV, NumPy, Shapely, RapidOCR (see `requirements.txt`)
- **AI:** OpenAI / Anthropic (explainer); configurable via environment
- **Chain:** Stellar SDK (testnet), memo-based attestation for hackathon demos
---
## Getting started
### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.10+ with `pip`
- **Clerk** application (email/password or your chosen strategies)
- Optional: **OpenAI** and/or **Anthropic** API keys for best explainability output

### 1. Clone and Python backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```
Create `backend/.env` (see variables below). Then:
```bash
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```
Health check: `GET http://localhost:8000/api/health`
### 2. Frontend
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
```bash
cd frontend
cp .env.example .env
# Set VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
npm install
npm run dev
```
5. Optional: run the Express API:
App defaults to Vite port **5173**. Without a Clerk publishable key, the app shows the setup screen instead of the full router.
### 3. Express + Clerk (optional, for protected API demo)
   ```bash
   cd server
   npm install
   npm run dev
   ```
```bash
cd server
cp .env.example .env
# CLERK_SECRET_KEY=sk_test_..., FRONTEND_URL=http://localhost:5173
npm install
npm run dev
```
## Routes
- `/sign-in`
- `/sign-up`
- `/dashboard`
- `/profile`
If the Express API is not running, the dashboard still renders and shows a graceful warning for the protected API card.
Match `VITE_API_URL` in `frontend/.env` to this server (default `http://localhost:8787`) if you use the dashboard’s protected API card.
### Run order for a full demo
1. FastAPI on **:8000** (required for upload and WebSocket progress)  
2. Vite on **:5173**  
3. Express on **:8787** (optional; Clerk-protected routes)

## Environment variables
### `backend/.env`
| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Explainability via OpenAI |
| `ANTHROPIC_API_KEY` | Explainability via Claude |
| `LLM_PROVIDER` | `openai` or `anthropic` (see [`pipeline/explainer.py`](backend/pipeline/explainer.py)) |
If keys are missing, the pipeline still runs using template-based explanations.
### `frontend/.env`
| Variable | Purpose |
|----------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk browser SDK |
| `VITE_API_URL` | Base URL for Express (default `http://localhost:8787`) |
### `server/.env`
| Variable | Purpose |
|----------|---------|
| `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk Express middleware |
| `FRONTEND_URL` | CORS origin (e.g. `http://localhost:5173`) |
| `PORT` | Default **8787** |
---
## API overview (FastAPI)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness |
| `POST` | `/api/pipeline` | Full pipeline: image → parse → geometry → materials → report → Three.js payload |
| `POST` | `/api/parse` | Parse + geometry only |
| `POST` | `/api/fallback` | Manual wall coordinates (hackathon disclosure path) |
| `WS` | `/ws/pipeline/{job_id}` | Progress events for pipeline runs |
| `GET` | `/api/conversion-history` | Recent upload/draw conversions |
| `GET` | `/api/draw-history` | Draw-studio history |
Interactive docs: `http://localhost:8000/docs` when the backend is running.

## Repository layout
```
AUTONOMOUS-<PROJECT-NAME>/
│
├── backend/
│   ├── data/
│   │   ├── conversion_history/
│   │   ├── draw_history/
│   │   ├── uploads/
│   │   └── materials.json
│   │
│   ├── pipeline/
│   │   ├── explainer.py
│   │   ├── geometry.py
│   │   ├── material.py
│   │   ├── openai_compat.py
│   │   ├── parser.py
│   │   └── validator.py
│   │
│   ├── app.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   │   └── AppLayout.jsx
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   └── clerkAppearance.js
│   │   ├── pages/
│   │   ├── stellar/
│   │   │   └── integration.js
│   │   ├── utils/
│   │   │   └── materialRanking.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/
│   ├── .gitignore
│   ├── package.json
│   └── package-lock.json
│
└── README.md
```
---
## Scripts
| Location | Command | Action |
|----------|---------|--------|
| `frontend/` | `npm run dev` | Vite dev server |
| `frontend/` | `npm run build` | Production build |
| `server/` | `npm run dev` | Node watch mode |
| `backend/` | `uvicorn app:app --reload --port 8000` | API + WebSocket |
---
## Team & acknowledgements
_Add your team names, roles, and sponsor/track (e.g. Stellar, AI track) here._
Built with [Clerk](https://clerk.com/), [Stellar](https://stellar.org/), and open-source libraries listed in `package.json` and `requirements.txt`.
---