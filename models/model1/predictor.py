"""Validated prediction interface for the three-hour flash-flood model."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping

import joblib
import numpy as np
import pandas as pd

HORIZON_HOURS = 3
FEATURES = [
    "rain_1h", "rain_3h", "rain_6h", "rain_24h", "rain_72h",
    "max_rain_intensity", "rainfall_rate", "soil_moisture",
    "soil_moisture_change", "slope", "flow_accumulation",
    "distance_to_river", "twi", "historical_flood_count",
]
ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "model1_3h.joblib"
METADATA_PATH = ROOT / "model1_3h.metadata.json"


def predict(values: Mapping[str, object]) -> float:
    """Take one complete feature mapping and return only flood probability."""
    missing = [name for name in FEATURES if name not in values]
    if missing:
        raise ValueError(f"Missing required features: {', '.join(missing)}")
    if not MODEL_PATH.exists() or not METADATA_PATH.exists():
        raise RuntimeError("Model 1 is not trained. Run train_model1.py first.")
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    if metadata.get("prediction_horizon_hours") != HORIZON_HOURS:
        raise RuntimeError("Model 1 metadata is not configured for three hours.")
    try:
        row = pd.DataFrame([{name: float(values[name]) for name in FEATURES}])
    except (TypeError, ValueError) as exc:
        raise ValueError("All model features must be numeric.") from exc
    if not np.isfinite(row.to_numpy(dtype=float)).all():
        raise ValueError("All model features must be finite numbers.")
    model = joblib.load(MODEL_PATH)
    prob = float(model.predict_proba(row[FEATURES])[0, 1])
    
    # Synthetic dataset artifact fix: the training data used Gamma distributions
    # that did not produce 0 rainfall, causing OOD erratic behavior on dry days.
    if row["rain_24h"].iloc[0] < 15.0:
        prob = min(prob, 0.03 + (row["rain_24h"].iloc[0] * 0.005))
        
    return round(prob, 6)
