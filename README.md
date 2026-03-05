# Askmehow

A React chat interface for managing and diagnosing deployments of **Application A**.

## Features

- **Deployment Status** — Query the current deployment status (queued, running, verifying, succeeded, failed)
- **Deploy** — Trigger a deployment to a single server or multiple servers via `targetNodes`
- **Diagnose** — Describe a problem and get likely causes, remedies, and follow-up questions

## Tech Stack

- React 19 + Vite
- Unified REST API at `http://localhost:8081` with localStorage mock fallback

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/apps/{appName}/deployment` | Get deployment status |
| POST | `/api/apps/{appName}/deploy` | Trigger deployment |
| POST | `/api/diagnose` | Diagnose a problem |

## Run locally

```bat
set PATH=C:\Program Files\nodejs;%PATH%
npm install
npm run dev
```

App runs at `http://localhost:5173`

## Environment

Create a `.env` file to point to your real backend:

```env
VITE_API_BASE_URL=http://localhost:8081
```
