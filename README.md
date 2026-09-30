# PRAVAAH

### Prototype disaster-risk awareness and early-warning dashboard

PRAVAAH combines location-based environmental data, machine-learning prototypes,
an explainable risk engine, interactive maps, safety guidance, shelter discovery,
and alert workflows in one web application.

> **Important:** PRAVAAH is a demonstration and research prototype. It is not
> an operational emergency-warning system. Always follow official
> disaster-management instructions and verify routes, shelters, and local
> conditions with the relevant authorities.

## What it does

- Accepts a location and retrieves current environmental context.
- Uses Open-Meteo for precipitation, forecast rainfall, surface soil moisture,
  and elevation.
- Estimates three-hour flash-flood probability with Model 1.
- Calculates dynamic landslide risk from rainfall, soil moisture, terrain, and
  static susceptibility context.
- Presents risk categories, contributing factors, history, charts, and maps.
- Publishes and displays community or authority alerts.
- Provides safety guidance, shelter discovery, and walking-route assistance.
- Includes a clearly labelled emergency-alert demonstration flow.

## Architecture

```text
Browser (React + TypeScript + Vite)
        |
        | /api/*
        v
Django API
  ├── Risk engine
  │     ├── Open-Meteo forecast data
  │     ├── Open-Meteo elevation data
  │     └── prototype risk rules
  ├── Model 1: three-hour flood probability
  ├── Model 2: static landslide susceptibility interface
  └── SQLite persistence for risk history and alerts
```

## Repository layout

```text
SIH_Round1/
├── backend/
│   ├── config/                 Django project configuration
│   ├── flood_api/              API views, risk engine, models, and tests
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── context/            Alert, role, and risk state
│   │   ├── imports/            Location and prediction UI
│   │   ├── services/           Browser API clients
│   │   ├── App.tsx             Application routes and screens
│   │   └── index.css           Global responsive styling
│   ├── package.json
│   └── vite.config.ts
├── models/
│   ├── model1/                 Three-hour flood model and trainer
│   └── model2/                 Static landslide susceptibility model
├── docs/
│   └── REAL_DATA.md            Data sources and prototype status
├── ui/                         Supporting UI assets
├── db.sqlite3                  Local development database
└── README.md
```

## Requirements

- Python 3.10 or newer
- Node.js 18 or newer
- npm 9 or newer
- Internet access for live Open-Meteo requests

## Quick start

### 1. Create the Python environment

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

If PowerShell blocks activation, run the commands through an already activated
Python environment or use:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

### 2. Generate the Model 1 artifact

The checked-in Model 1 artifact can be used directly. To regenerate it from
the reproducible prototype dataset:

```powershell
python models\model1\train_model1.py
```

This writes `model1_3h.joblib`, its metadata file, and the generated training
dataset under `models\model1\`.

### 3. Start the Django API

```powershell
python backend\manage.py migrate
python backend\manage.py runserver
```

The API runs at `http://127.0.0.1:8000`.

### 4. Start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:8443`).
The development proxy forwards `/api` requests to the Django server.

### 5. Build the frontend

```powershell
cd frontend
npm run build
```

The production bundle is generated in `frontend\dist`.

## Configuration

Copy `.env.example` to `.env` or configure the variables in the environment
before starting Django:

| Variable | Purpose | Default |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | Django signing key | `change-me` in local configuration |
| `PRAVAAH_API_TIMEOUT_SECONDS` | Timeout for external data requests | `15` |
| `PRAVAAH_CACHE_TTL_SECONDS` | In-memory provider-cache lifetime | `300` |
| `VITE_API_BASE` | Browser API base URL | Empty; uses `/api` |
| `VITE_API_TARGET` | Vite proxy target | `http://127.0.0.1:8000` |
| `PORT` | Frontend development port | `8443` |

Do not commit real credentials or production secrets.

## API

All application endpoints are mounted under `/api/`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/model1/predict` | Return a three-hour flood probability |
| `POST` | `/api/risk-engine/` | Fetch location data and return integrated risk |
| `GET` | `/api/risk-history/?latitude={lat}&longitude={lon}` | Return nearby risk evaluations |
| `GET` | `/api/alerts/` | Return the latest published alerts |
| `POST` | `/api/alerts/` | Persist a new alert |

### Risk-engine request

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/risk-engine/ `
  -H "Content-Type: application/json" `
  -d '{"latitude":30.6739,"longitude":78.4827}'
```

### Model 1 request

Model 1 accepts one complete feature mapping and returns one flood probability
in the range `0..1`. Every feature is required:

```json
{
  "rain_1h": 12.0,
  "rain_3h": 28.0,
  "rain_6h": 45.0,
  "rain_24h": 90.0,
  "rain_72h": 180.0,
  "max_rain_intensity": 12.0,
  "rainfall_rate": 1.2,
  "soil_moisture": 0.72,
  "soil_moisture_change": 0.08,
  "slope": 18.0,
  "flow_accumulation": 120.0,
  "distance_to_river": 250.0,
  "twi": 9.0,
  "historical_flood_count": 2
}
```

The Python interface is intentionally small and validated:

```python
from models.model1.predictor import predict

probability = predict(features)
```

It rejects missing, non-numeric, or non-finite values and verifies that the
saved artifact is configured for the three-hour horizon.

## Model components

### Model 1: flash-flood probability

- `models/model1/predictor.py` exposes `predict(values) -> float`.
- Uses a `RandomForestClassifier`.
- Uses 14 rainfall, soil, terrain, hydrology, and historical-event features.
- The current training dataset is generated prototype data.
- Dry-day output is bounded to reduce out-of-distribution behaviour from the
  synthetic training distribution.

### Model 2: static landslide susceptibility

- `models/model2/predictor.py` exposes `predict(values) -> float`.
- Uses a saved Random Forest model and preprocessing pipeline.
- Requires 17 static terrain, hydrology, soil, land-cover, vegetation, and
  rainfall-climatology features.
- Returns a susceptibility score in the range `0..1`.
- Dynamic rainfall and soil-moisture risk is handled separately by the backend
  risk engine.

## Data sources and limitations

Live values currently come from:

- Open-Meteo Forecast API: precipitation, hourly forecasts, and soil moisture.
- Open-Meteo Elevation API: terrain elevation.
- ERA5-Land `soil_moisture_0_7cm`: the soil-moisture context used by Open-Meteo.

The following areas remain prototypes and require validation before any
operational use:

- Model 1 is trained on generated synthetic data, not verified disaster events.
- Model 2 does not yet perform a production geospatial static-raster lookup.
- Risk weights, thresholds, normalisation, and categories are prototype rules.
- Temporary shelters and routes are demonstration data and may be inaccurate.
- The backend cache is in-memory and is not intended for a distributed
  production deployment.

See [`docs/REAL_DATA.md`](docs/REAL_DATA.md) for provider details, historical
rainfall calculations, and the current real-data/prototype boundary.

## Development and testing

Run the Django test suite from the repository root:

```powershell
python backend\manage.py test flood_api
```

Useful commands:

| Command | Directory | Purpose |
| --- | --- | --- |
| `npm run dev` | `frontend` | Start the Vite development server |
| `npm run build` | `frontend` | Build the frontend |
| `npm run preview` | `frontend` | Preview the production build |
| `npm run format` | `frontend` | Format frontend files with oxfmt |
| `python backend\manage.py test flood_api` | root | Run backend tests |
| `python models\model1\train_model1.py` | root | Rebuild Model 1 artifacts |

## Responsible use

This project must not be used as the sole basis for evacuation, rescue,
medical, infrastructure, or other safety-critical decisions. Treat its scores
and alerts as experimental decision-support output, confirm information with
official agencies, and replace prototype data and thresholds with validated
local datasets before deployment.

## License

This repository is provided for educational and prototype-development
purposes. Add a formal open-source or institutional license before distributing
or deploying it outside that scope.
