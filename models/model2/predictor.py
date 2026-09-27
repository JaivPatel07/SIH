"""
Validated prediction interface for HIM-SHIELD Model 2.

Model 2 predicts static landslide susceptibility for a geographic cell.
The dynamic rainfall/soil-moisture risk engine is handled separately.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping

import joblib
import numpy as np
import pandas as pd


FEATURES = [
    "elevation",
    "slope",
    "aspect_sin",
    "aspect_cos",
    "curvature",
    "upstream_area",
    "TWI",
    "drainage_density",
    "distance_to_drainage",
    "clay_surface",
    "organic_carbon_surface",
    "landcover",
    "NDVI",
    "mean_annual_rainfall",
    "max_daily_rainfall",
    "mean_monsoon_rainfall",
    "high_rain_days",
]

ROOT = Path(__file__).resolve().parent

MODEL_PATH = ROOT / "model2_static_final_model.joblib"
PREPROCESSOR_PATH = ROOT / "model2_static_preprocessor.joblib"
CONFIG_PATH = ROOT / "model2_static_config.json"


def _load_config() -> dict:
    """Load Model 2 configuration metadata."""
    if not CONFIG_PATH.exists():
        return {}

    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def _load_artifacts():
    """Load the trained Model 2 model and preprocessing pipeline."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model 2 model not found: {MODEL_PATH}"
        )

    if not PREPROCESSOR_PATH.exists():
        raise FileNotFoundError(
            f"Model 2 preprocessor not found: {PREPROCESSOR_PATH}"
        )

    model = joblib.load(MODEL_PATH)
    preprocessor = joblib.load(PREPROCESSOR_PATH)

    return model, preprocessor


def predict(values: Mapping[str, float]) -> float:
    """
    Predict static landslide susceptibility.

    Parameters
    ----------
    values:
        Mapping containing all 17 Model 2 static features.

    Returns
    -------
    float
        Landslide susceptibility score in the range [0, 1].
    """

    missing = [name for name in FEATURES if name not in values]

    if missing:
        raise ValueError(
            "Missing required Model 2 features: "
            + ", ".join(missing)
        )

    try:
        row = {
            feature: float(values[feature])
            for feature in FEATURES
        }
    except (TypeError, ValueError) as exc:
        raise ValueError(
            "All Model 2 feature values must be numeric."
        ) from exc

    frame = pd.DataFrame([row], columns=FEATURES)

    if not np.isfinite(frame.to_numpy(dtype=float)).all():
        raise ValueError(
            "Model 2 features must contain only finite numeric values."
        )

    model, preprocessor = _load_artifacts()

    transformed = preprocessor.transform(frame)

    probability = float(
        model.predict_proba(transformed)[0, 1]
    )

    return float(np.clip(probability, 0.0, 1.0))


def get_model_info() -> dict:
    """Return basic Model 2 metadata."""
    config = _load_config()

    return {
        "model": "HIM-SHIELD Model 2",
        "component": "Static Landslide Susceptibility",
        "features": FEATURES,
        "feature_count": len(FEATURES),
        "model_type": "RandomForestClassifier",
        "threshold": config.get("threshold", 0.40),
        "dynamic_risk_engine": (
            "Handled separately using current rainfall "
            "and soil moisture."
        ),
    }


if __name__ == "__main__":
    print(json.dumps(get_model_info(), indent=2))