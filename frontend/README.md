# PRAVAAH — Hyper-Local Flash Flood & Landslide Early Warning System

> **Flow of Safety**: India's premier AI-powered disaster-tech platform designed for high-risk Himalayan river basins (Bhagirathi & Yamuna Valleys, Uttarakhand).

---

## 🌊 Overview

**PRAVAAH** is a real-time early warning and disaster response web application built to protect vulnerable mountain communities and assist District Disaster Management Authorities (DDMA). Unlike generic weather apps that broadcast broad district warnings hours late, PRAVAAH processes village-level IoT sensor telemetry, hydrological stream flow data, and slope stability models to deliver predictive warnings with a **12-minute lead time**.

---

## ✨ Key Features

- **⚡ 12-Minute Predictive Warning Lead Time:** Notifies residents before flash floods reach populated riverbanks.
- **🧠 Multi-Model AI Risk Engine:** Integrates Model 1 (Flash Flood Runoff) and Model 2 (Landslide Dynamic Risk) with real-time soil moisture gauges.
- **🗺️ Interactive Live Risk Map:** Visualizes Bhagirathi Valley stream levels, active road hazard statuses, sensor beacons, and risk zones.
- **🏠 Verified Safe Shelter Finder:** Turn-by-turn routing to nearby relief shelters with real-time room capacity and road accessibility tracking.
- **🛡️ Dual Community & Authority View:**
  - **User Mode:** Clean, plain-language action advisories and shelter directions for villagers.
  - **Authority Mode:** Control room dashboard, 51-sensor network telemetry, and 1-click public advisory dispatch.
- **📶 Offline Resilience & Sync:** Pre-caches emergency shelter directions and Siren advisories for cellular outages.

---

## 🛠️ Technology Stack

- **Frontend Framework:** [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Routing:** [React Router 7](https://reactrouter.com/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + Custom CSS Design System
- **Icons & Animations:** [Lucide React](https://lucide.dev/) + [Framer Motion](https://www.framer.com/motion/)
- **Data Visualization:** [Recharts](https://recharts.org/)

---

## 🚀 How to Run the App

Follow these steps to run the application on your local machine:

### 1. Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (version 18.0.0 or higher) installed on your system.

Verify your installation:
```bash
node -v
npm -v
```

### 2. Install Dependencies

Open your terminal in the project directory and run:

```bash
npm install
```

### 3. Start Development Server

Run the development server with hot-reloading enabled:

```bash
npm run dev
```

Once started, open your web browser and navigate to:
```
http://localhost:5173
```
*(Or the local port shown in your terminal output).*

---

## 📜 Available Scripts

In the project directory, you can run:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server with instant hot reload. |
| `npm run build` | Builds the optimized production bundle in the `dist/` directory. |
| `npm run preview` | Previews the production build locally. |
| `npm run format` | Formats code files using `oxfmt`. |

---

## 📁 Project Structure

```
PRAVAAH Disaster-Tech Web App/
├── src/
│   ├── context/
│   │   ├── AlertContext.tsx       # Alert state management & emergency dispatch
│   │   └── RoleContext.tsx        # User vs. Authority role switching
│   ├── services/
│   │   ├── model1Service.ts       # Flash flood hydrological runoff model
│   │   ├── model2Service.ts       # Landslide terrain susceptibility & dynamic risk
│   │   └── riskEngineService.ts   # Integrated operational classification engine
│   ├── App.tsx                    # Main React entrypoint, routes, map canvas & pages
│   ├── index.css                  # Global Tailwind CSS v4 setup & responsive themes
│   └── main.tsx                   # React root mount
├── public/                        # Static assets & favicon
├── package.json                   # Project dependencies and npm scripts
├── vite.config.ts                 # Vite bundler configuration
└── README.md                      # Documentation & instructions
```

---

## 📞 Emergency Helplines (Pilot Zone)

- **National Disaster Helpline:** `1077 / 112`
- **Uttarakhand SDMA Control Room:** `+91-135-2710334`
- **NDRF Response Cell:** `011-24363260`

---

## 📄 License

Developed for educational, research, and Himalayan river basin disaster mitigation initiatives.
