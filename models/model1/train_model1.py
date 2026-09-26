"""Create a reproducible three-hour Model 1 prototype artifact.

Replace the generated dataset with verified IMD/MOSDAC/Bhuvan/event data for
operational training. The downloaded DHARA artifact is retained separately
because it was trained with a six-hour horizon and synthetic labels.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from predictor import FEATURES, HORIZON_HOURS, METADATA_PATH, MODEL_PATH

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "model1_prototype_dataset.csv"


def main() -> None:
    rng = np.random.default_rng(20260926)
    n = 6000
    rain_1h = rng.gamma(1.8, 7.0, n)
    rain_3h = rain_1h + rng.gamma(2.0, 9.0, n)
    rain_6h = rain_3h + rng.gamma(2.2, 12.0, n)
    rain_24h = rain_6h + rng.gamma(2.0, 22.0, n)
    rain_72h = rain_24h + rng.gamma(2.2, 42.0, n)
    max_intensity = np.maximum(rain_1h, rain_3h / 3)
    rainfall_rate = np.clip(rng.normal(0.5, 0.35, n), 0, 3)
    soil = np.clip(rng.beta(3.0, 2.0, n), 0.03, 0.98)
    change = np.clip(rng.normal(0.02, 0.10, n), -0.5, 0.5)
    slope = rng.uniform(0, 45, n)
    flow = np.clip(rng.lognormal(2.5, 1.2, n), 0, 1000)
    river = np.clip(rng.gamma(2, 250, n), 1, 5000)
    twi = np.clip(rng.normal(8, 3, n), 0, 20)
    history = rng.poisson(2, n)
    latent = (
        2.5 * rain_1h / 25 + 2 * rain_6h / 90 + 1.2 * rain_72h / 260
        + 1.5 * soil + 0.5 * np.maximum(change, 0) + 1.2 * slope / 45
        + twi / 12 + flow / 500 + 0.7 * history / 3 - river / 5000 - 3
    )
    event_probability = 1 / (1 + np.exp(-np.clip(latent, -30, 30)))
    event = rng.binomial(1, event_probability)
    frame = pd.DataFrame({
        "rain_1h": rain_1h, "rain_3h": rain_3h, "rain_6h": rain_6h,
        "rain_24h": rain_24h, "rain_72h": rain_72h,
        "max_rain_intensity": max_intensity, "rainfall_rate": rainfall_rate,
        "soil_moisture": soil, "soil_moisture_change": change, "slope": slope,
        "flow_accumulation": flow, "distance_to_river": river, "twi": twi,
        "historical_flood_count": history,
        "event": event,
    })
    frame.to_csv(DATA_PATH, index=False)
    model = RandomForestClassifier(
        n_estimators=300, max_depth=12, min_samples_leaf=3,
        class_weight="balanced_subsample", random_state=20260926, n_jobs=-1,
    )
    model.fit(frame[FEATURES], frame["event"])
    joblib.dump(model, MODEL_PATH)
    METADATA_PATH.write_text(json.dumps({
        "model": "RandomForestClassifier",
        "prediction_horizon_hours": HORIZON_HOURS,
        "features": FEATURES,
        "synthetic_data": True,
        "warning": "Prototype only; retrain with verified historical events.",
        "rows": n,
    }, indent=2), encoding="utf-8")
    print(f"Saved {MODEL_PATH}")


if __name__ == "__main__":
    main()
