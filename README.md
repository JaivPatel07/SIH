# PRAVAAH

PRAVAAH is a prototype disaster-risk awareness platform for flood and landslide monitoring. It combines location-based environmental data, a three-hour flash-flood prediction model, a dynamic landslide-risk calculation, interactive maps, safety guidance, shelter routing, and an alert workflow.

This project is for demonstration, research, and educational use. It is not an operational emergency-warning system and must not replace official disaster-management instructions.

## Features

- Location-based flood and landslide risk assessment
- Rainfall, soil-moisture, elevation, and terrain inputs
- Three-hour flash-flood probability model
- Dynamic landslide-risk score with an explanation of contributing factors
- Risk history, charts, forecast, and interactive map views
- Community alerts and authority alert publishing
- Automatic in-app warnings when risk thresholds are reached
- Shelter discovery and walking directions
- A clearly labelled top-bar emergency demo with temporary safe-place data

## Project Structure

```text
SIH/
+-- frontend/                 React, TypeScript, Vite application
|   +-- src/
|   |   +-- context/          Alert, role, and location/risk state
|   |   +-- imports/          Prediction, location, and modal UI
|   |   +-- services/         Browser API client
|   |   +-- App.tsx           Routes and application UI
|   |   `-- index.css         Global styles and responsive layout
|   +-- package.json
|   `-- vite.config.ts
+-- backend/                  Django API
|   +-- config/               Django settings and root URLs
|   `-- flood_api/            Risk engine, alerts, and API views
+-- models/
|   +-- model1/               Flash-flood prototype model and trainer
|   `-- model2/               Landslide prototype utilities
`-- README.md
```

## Requirements

- Node.js 18 or later
- npm 9 or later
- Python 3.10 or later
- Internet access for live Open-Meteo environmental data

## Run Locally

Open two terminals from the repository root.

### 1. Start the backend

Create and activate a virtual environment, then install the Django dependencies.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

Generate the Model 1 prototype artifact once before starting the API.

```powershell
python models\model1\train_model1.py
```

Apply database migrations and run Django.

```powershell
python backend\manage.py migrate
python backend\manage.py runserver
```

The API is available at `http://127.0.0.1:8000`.

### 2. Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

Vite normally starts the application at `http://localhost:8443`. The development server proxies `/api` requests to `http://127.0.0.1:8000` by default.

### 3. Build the frontend

```powershell
cd frontend
npm run build
```

The production bundle is written to `frontend/dist`.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE` | Base URL used by the browser API client. | Empty string; uses same-origin `/api` |
| `VITE_API_TARGET` | Django target used by the Vite development proxy. | `http://127.0.0.1:8000` |
| `PORT` | Vite development-server port. | `8443` |

Example `frontend/.env.local`:

```dotenv
VITE_API_TARGET=http://127.0.0.1:8000
```

## API Endpoints

All endpoints are served under `/api/`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/model1/predict` | Returns a flood probability for a complete Model 1 feature payload. |
| `POST` | `/api/risk-engine/` | Retrieves environmental inputs and returns integrated risk data for latitude and longitude. |
| `GET` | `/api/risk-history/?latitude={lat}&longitude={lon}` | Returns recent risk evaluations near a location. |
| `GET` | `/api/alerts/` | Returns the 50 latest published alerts. |
| `POST` | `/api/alerts/` | Creates an alert record. |

Example risk-engine request:

```json
{
  "latitude": 30.6739,
  "longitude": 78.4827
}
```

## Alert Behaviour

- Flood probability or landslide risk at or above 60% creates a High alert.
- Risk at or above 80% creates a Critical escalation alert.
- Duplicate alerts are limited per browser session and location/severity band.

The top-bar `Try alert demo` button uses simulated data only. It displays a red safety scan followed by a temporary shelter and an optional Google Maps walking route from the selected location.

## Development Notes

- The Django risk endpoint requests live data from Open-Meteo. Requests can fail when that service or the network is unavailable.
- The application displays sample alerts when no live alerts are available.
- Model 1 is trained from generated prototype data and is not operationally validated.
- Static susceptibility and generated temporary shelter information are demonstration layers, not authoritative geographic or emergency-response data.
- Verify safe routes, shelter availability, and emergency guidance with local authorities.

## Useful Commands

| Command | Location | Purpose |
| --- | --- | --- |
| `npm run dev` | `frontend` | Start the Vite development server. |
| `npm run build` | `frontend` | Create a production frontend build. |
| `npm run preview` | `frontend` | Serve the production build locally. |
| `python backend/manage.py runserver` | Repository root | Start the Django API. |
| `python models/model1/train_model1.py` | Repository root | Generate the Model 1 prototype artifact. |

## License

This repository is provided for educational and prototype-development purposes. Add a formal license before distributing or deploying it outside that scope.
