# FoodTracker (personal)

A simple **personal** profit/loss tracker for cooking/meal prep:

- Track **revenue** and **expenses** (ingredients, packaging, utilities, etc.)
- Dashboard shows **monthly & yearly** profit/loss, spend by category, and profit trend

## Project structure

- `backend/`: Node.js + Express + SQLite API
- `frontend/`: React + Vite personal dashboard website

## Run locally

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001` and stores data in `backend/data/foodtracker.db`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies API requests to the backend at `http://localhost:3001`.

## What to log

- **Revenue**: sales / catering / orders (category like `sales`)
- **Expenses**: ingredients, packaging, labor, rent, etc.

## Currency

Frontend displays money in **KES**.