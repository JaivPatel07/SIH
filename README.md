# SIH Round 1 — PRAVAAH Disaster-Tech Platform & Models

Repository: [Preyans-alt/SIH_Round1](https://github.com/Preyans-alt/SIH_Round1)

---

## 📁 Repository Structure

```
SIH_Round1/
├── frontend/             # PRAVAAH React 19 + Vite + Tailwind CSS Web Application
│   ├── src/             # UI Components, Risk Map, AI Models, Context Providers
│   ├── package.json     # App Dependencies & Scripts
│   └── README.md        # Detailed Frontend Setup & Docs
├── backend/              # Django Backend API & Model Services
└── models/               # Python AI Models (Model 1 & Model 2)
```

---

## 🚀 Quick Start (Frontend)

To run the PRAVAAH Web Application locally:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🤖 AI Models & Backend Setup

### Model 1 — Flash Flood Probability

Model 1 predicts a numeric flash-flood probability for the next three hours.

```cmd
python -m pip install -r backend\requirements.txt
python models\model1\train_model1.py
python backend\manage.py runserver
```

Endpoint: `POST http://127.0.0.1:8000/api/model1/predict`

---

### Model 2 — Landslide Susceptibility

Model 2 predicts a numeric landslide susceptibility score for a geographic cell using terrain, soil, land-cover, and vegetation features.

```cmd
python -m venv .venv-model2
.venv-model2\Scripts\activate
python -m pip install -r models\model2\requirements.txt
python -m models.model2.predictor
```
