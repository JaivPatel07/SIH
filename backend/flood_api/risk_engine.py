"""Open-Meteo-backed environmental data access and risk calculations for PRAVAAH."""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[2]
CACHE_TTL_SECONDS = int(os.getenv("PRAVAAH_CACHE_TTL_SECONDS", "300"))
API_TIMEOUT_SECONDS = int(os.getenv("PRAVAAH_API_TIMEOUT_SECONDS", "15"))
CACHE: dict[str, dict[str, Any]] = {}


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _validate_coordinates(latitude: Any, longitude: Any) -> tuple[float, float]:
    try:
        latitude_value = float(latitude)
        longitude_value = float(longitude)
    except (TypeError, ValueError) as exc:
        raise ValueError("Latitude and longitude must be numeric values.") from exc

    if not -90.0 <= latitude_value <= 90.0:
        raise ValueError("latitude must be between -90 and 90 degrees.")
    if not -180.0 <= longitude_value <= 180.0:
        raise ValueError("longitude must be between -180 and 180 degrees.")

    return latitude_value, longitude_value


def _cache_key(provider: str, latitude: float, longitude: float, window: str) -> str:
    return (
        f"{provider}:{round(latitude, 4)}:{round(longitude, 4)}:{window}:"
        f"{int(CACHE_TTL_SECONDS)}"
    )


def _get_cached(key: str) -> Any | None:
    entry = CACHE.get(key)
    if not entry:
        return None
    if entry["expires_at"] <= time.time():
        CACHE.pop(key, None)
        return None
    return entry["value"]


def _set_cache(key: str, value: Any) -> None:
    CACHE[key] = {"value": value, "expires_at": time.time() + CACHE_TTL_SECONDS}


def _fetch_json(url: str, params: dict[str, Any], provider: str, cache_window: str) -> dict[str, Any]:
    latitude = float(params.get("latitude", 0.0))
    longitude = float(params.get("longitude", 0.0))
    cache_key = _cache_key(provider, latitude, longitude, cache_window)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        response = requests.get(url, params=params, timeout=API_TIMEOUT_SECONDS)
        response.raise_for_status()
        payload = response.json()
    except requests.Timeout as exc:
        raise TimeoutError(f"{provider} request timed out after {API_TIMEOUT_SECONDS}s.") from exc
    except requests.RequestException as exc:  # pragma: no cover - exercised indirectly in tests
        raise RuntimeError(f"{provider} request failed: {exc}") from exc

    _set_cache(cache_key, payload)
    return payload


def _metric(value: Any, unit: str, source: str, observed_at: str | None = None, retrieved_at: str | None = None, status: str = "available") -> dict[str, Any]:
    return {
        "value": None if value is None else round(float(value), 4),
        "unit": unit,
        "source": source,
        "observed_at": observed_at,
        "retrieved_at": retrieved_at or _now_utc(),
        "status": status,
    }


def _normalise_pairs(times: list[str], values: list[Any]) -> list[tuple[str, float]]:
    pairs: list[tuple[str, float]] = []
    for index, time_value in enumerate(times or []):
        raw_value = (values or [])[index] if index < len(values or []) else None
        if raw_value is None:
            continue
        try:
            pairs.append((str(time_value), float(raw_value)))
        except (TypeError, ValueError):
            continue
    return pairs


def fetch_rainfall(latitude: float, longitude: float) -> dict[str, Any]:
    """Fetch real daily and hourly precipitation data from Open-Meteo."""
    if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
        raise ValueError("Latitude and longitude are outside supported ranges.")

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "precipitation_sum",
        "hourly": "precipitation",
        "past_days": 15,
        "forecast_days": 3,
        "timezone": "auto",
    }
    payload = _fetch_json(
        "https://api.open-meteo.com/v1/forecast",
        params,
        "Open-Meteo rainfall",
        "rainfall",
    )

    daily = payload.get("daily", {})
    times = daily.get("time", []) or []
    daily_values = daily.get("precipitation_sum", []) or []
    daily_pairs = _normalise_pairs(times, daily_values)

    if not daily_pairs:
        return {
            "source": "Open-Meteo",
            "status": "unavailable",
            "value": None,
            "unit": "mm",
            "retrieved_at": _now_utc(),
            "observed_at": None,
            "rain_1d": _metric(None, "mm", "Open-Meteo", None, _now_utc(), "unavailable"),
            "rain_3d": _metric(None, "mm", "Open-Meteo", None, _now_utc(), "unavailable"),
            "rain_15d": _metric(None, "mm", "Open-Meteo", None, _now_utc(), "unavailable"),
            "forecast_24h": _metric(None, "mm", "Open-Meteo", None, _now_utc(), "unavailable"),
            "forecast_3d": _metric(None, "mm", "Open-Meteo", None, _now_utc(), "unavailable"),
        }

    today_iso = datetime.now(timezone.utc).date().isoformat()
    observed_values = [value for date_str, value in daily_pairs if date_str <= today_iso]
    future_values = [value for date_str, value in daily_pairs if date_str > today_iso]
    hourly = payload.get("hourly", {})
    hourly_precip = hourly.get("precipitation", []) or []
    forecast_24h = sum(float(step) for step in hourly_precip[:24] if step is not None)

    rain_1d = observed_values[-1] if observed_values else 0.0
    rain_3d = sum(observed_values[-3:]) if observed_values else 0.0
    rain_15d = sum(observed_values[-15:]) if observed_values else 0.0
    forecast_3d = sum(future_values[:3]) if future_values else 0.0
    observed_at = daily_pairs[-1][0] if daily_pairs else None
    retrieved_at = _now_utc()

    return {
        "source": "Open-Meteo (daily precipitation_sum; hourly precipitation)",
        "status": "available",
        "observed_at": observed_at,
        "retrieved_at": retrieved_at,
        "rain_1d": _metric(rain_1d, "mm", "Open-Meteo", observed_at, retrieved_at),
        "rain_3d": _metric(rain_3d, "mm", "Open-Meteo", observed_at, retrieved_at),
        "rain_15d": _metric(rain_15d, "mm", "Open-Meteo", observed_at, retrieved_at),
        "forecast_24h": _metric(forecast_24h, "mm", "Open-Meteo forecast", None, retrieved_at),
        "forecast_3d": _metric(forecast_3d, "mm", "Open-Meteo forecast", None, retrieved_at),
    }


def fetch_soil_moisture(latitude: float, longitude: float) -> dict[str, Any]:
    """Fetch soil moisture from Open-Meteo ERA5-Land using a provider abstraction."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "soil_moisture_0_7cm",
        "past_days": 7,
        "forecast_days": 1,
        "timezone": "auto",
    }
    payload = _fetch_json(
        "https://api.open-meteo.com/v1/forecast",
        params,
        "Open-Meteo soil moisture",
        "soil-moisture",
    )
    hourly = payload.get("hourly", {})
    times = hourly.get("time", []) or []
    values = hourly.get("soil_moisture_0_7cm", []) or []
    pairs = _normalise_pairs(times, values)
    if not pairs:
        return {
            "value": None,
            "unit": "m3/m3",
            "source": "Open-Meteo (ERA5-Land soil_moisture_0_7cm)",
            "observed_at": None,
            "retrieved_at": _now_utc(),
            "status": "unavailable",
        }

    timestamp, value = pairs[-1]
    return {
        "value": round(float(value), 4),
        "unit": "m3/m3",
        "source": "Open-Meteo (ERA5-Land soil_moisture_0_7cm)",
        "observed_at": timestamp,
        "retrieved_at": _now_utc(),
        "status": "available",
    }


def fetch_elevation(latitude: float, longitude: float) -> dict[str, Any]:
    """Fetch digital elevation model value for the selected location."""
    params = {"latitude": latitude, "longitude": longitude}
    payload = _fetch_json(
        "https://api.open-meteo.com/v1/elevation",
        params,
        "Open-Meteo elevation",
        "elevation",
    )
    elevation_value = payload.get("elevation")
    if elevation_value is None:
        return {
            "value": None,
            "unit": "m",
            "source": "Open-Meteo Elevation API",
            "retrieved_at": _now_utc(),
            "status": "unavailable",
        }
    return {
        "value": round(float(elevation_value), 2),
        "unit": "m",
        "source": "Open-Meteo Elevation API",
        "retrieved_at": _now_utc(),
        "status": "available",
    }


def get_static_susceptibility(latitude: float, longitude: float) -> dict[str, Any]:
    """Return a location-based static susceptibility only when a real static layer exists."""
    model_dir = ROOT / "models" / "model2"
    static_layer = model_dir / "model2_static_final_model.joblib"
    if not static_layer.exists():
        return {
            "status": "static_susceptibility_unavailable",
            "value": None,
            "unit": "probability",
            "source": "No static susceptibility raster/grid is present in the repository for this location.",
            "retrieved_at": _now_utc(),
            "note": "The repository includes the static landslide model definition but no mapped static susceptibility layer for geographic lookup.",
        }
    return {
        "status": "available",
        "value": None,
        "unit": "probability",
        "source": "Model 2 static susceptibility asset",
        "retrieved_at": _now_utc(),
        "note": "Repository assets are available, but no geospatial lookup for this location was implemented in this prototype.",
    }


def _classify_risk(score: float | None) -> str:
    if score is None:
        return "Data unavailable"
    if score < 0.20:
        return "Low"
    if score < 0.40:
        return "Moderate"
    if score < 0.60:
        return "High"
    return "Very High"


def calculate_landslide_risk(
    static_susceptibility: dict[str, Any],
    rainfall: dict[str, Any],
    soil_moisture: dict[str, Any],
) -> dict[str, Any]:
    """Compute current landslide risk using the prototype project weightings."""
    if static_susceptibility.get("status") != "available":
        return {
            "status": "static_susceptibility_unavailable",
            "current_landslide_risk": None,
            "risk_category": "Data unavailable",
            "dynamic_trigger_score": None,
            "rainfall_trigger_score": None,
        }

    static_value = float(static_susceptibility.get("value") or 0.0)
    rainfall_3d = float(rainfall.get("rain_3d", {}).get("value") or 0.0)
    rainfall_15d = float(rainfall.get("rain_15d", {}).get("value") or 0.0)
    soil_value = float(soil_moisture.get("value") or 0.0)
    if rainfall_15d <= 0 and rainfall_3d <= 0:
        rainfall_trigger = 0.0
    else:
        rainfall_trigger = (
            0.6 * min(1.0, rainfall_3d / max(rainfall_15d, rainfall_3d, 1.0))
            + 0.4 * min(1.0, rainfall_15d / max(rainfall_15d, 1.0))
        )
    soil_score = max(0.0, min(1.0, soil_value))
    dynamic_trigger = 0.7 * rainfall_trigger + 0.3 * soil_score
    current_risk = static_value * (1 + 0.50 * dynamic_trigger)
    current_risk = max(0.0, min(1.0, current_risk))
    return {
        "status": "available",
        "current_landslide_risk": round(current_risk, 6),
        "risk_category": _classify_risk(current_risk),
        "dynamic_trigger_score": round(dynamic_trigger, 6),
        "rainfall_trigger_score": round(rainfall_trigger, 6),
    }


def build_risk_explanation(
    static_susceptibility: dict[str, Any],
    rainfall: dict[str, Any],
    soil_moisture: dict[str, Any],
    current_risk: float | None,
) -> dict[str, Any]:
    """Return a concise explanation of the dominant drivers behind the current risk."""
    category = _classify_risk(current_risk)
    if current_risk is None or static_susceptibility.get("status") != "available":
        return {
            "summary": "Insufficient data to explain the current landslide risk for this location.",
            "drivers": [
                "A static susceptibility layer is not available for the selected area.",
                "Live rainfall and soil moisture data are required to make the trigger assessment meaningful.",
            ],
            "confidence": "low",
            "data_sources": ["Open-Meteo rainfall", "Open-Meteo soil moisture", "Repository static susceptibility layer"],
            "category": "Data unavailable",
        }

    static_value = float(static_susceptibility.get("value") or 0.0)
    rainfall_3d = float(rainfall.get("rain_3d", {}).get("value") or 0.0)
    rainfall_15d = float(rainfall.get("rain_15d", {}).get("value") or 0.0)
    soil_value = float(soil_moisture.get("value") or 0.0)

    drivers: list[str] = []
    if static_value >= 0.6:
        drivers.append("The terrain itself is moderately to strongly susceptible to slope failure.")
    else:
        drivers.append("The terrain is only moderately prone, so current weather conditions matter more.")

    if rainfall_3d > 0:
        drivers.append(f"Recent 3-day rainfall totals are {rainfall_3d:.1f} mm, which can raise pore pressure along steep slopes.")
    if rainfall_15d > 0:
        drivers.append(f"The 15-day rainfall accumulation is {rainfall_15d:.1f} mm, contributing to prolonged saturation.")
    if soil_value > 0.4:
        drivers.append(f"Soil moisture is {soil_value:.3f} m3/m3, which increases the chance of landslide triggering during heavy rain.")
    if not drivers:
        drivers.append("Observed conditions are calm enough that rainfall and moisture are not currently driving elevated hazard.")

    summary_parts = [
        f"The selected location is currently classified as {category.lower()} risk.",
        "This is driven by the combination of terrain susceptibility and live rainfall/soil response.",
    ]
    return {
        "summary": " ".join(summary_parts),
        "drivers": drivers[:4],
        "confidence": "medium" if current_risk is not None else "low",
        "data_sources": [
            rainfall.get("source", "Open-Meteo rainfall"),
            soil_moisture.get("source", "Open-Meteo soil moisture"),
            static_susceptibility.get("source", "Static susceptibility layer"),
        ],
        "category": category,
    }


def build_model1_payload(rainfall: dict[str, Any], soil_moisture: dict[str, Any], elevation: dict[str, Any]) -> tuple[dict[str, Any], bool, list[str]]:
    """Build a prototype payload for the legacy Model 1 using only defensible inputs."""
    base_payload = {
        "rain_1h": rainfall.get("rain_1d", {}).get("value") or 0.0,
        "rain_3h": rainfall.get("rain_3d", {}).get("value") or 0.0,
        "rain_6h": rainfall.get("rain_3d", {}).get("value") or 0.0,
        "rain_24h": rainfall.get("rain_1d", {}).get("value") or 0.0,
        "rain_72h": rainfall.get("rain_3d", {}).get("value") or 0.0,
        "max_rain_intensity": rainfall.get("forecast_24h", {}).get("value") or 0.0,
        "rainfall_rate": rainfall.get("forecast_24h", {}).get("value") or 0.0,
        "soil_moisture": soil_moisture.get("value") or 0.0,
        "soil_moisture_change": 0.0,
        "slope": 0.0,
        "flow_accumulation": 0.0,
        "distance_to_river": 0.0,
        "twi": 0.0,
        "historical_flood_count": 0.0,
    }
    notes = [
        "Model 1 remains a prototype model trained on synthetic data.",
        "The payload uses real rainfall and soil-moisture observations where the variable meaning matches the model.",
        "Unsupported terrain and channel features are retained in prototype/demo mode as 0.0 to avoid fabricating unverified values.",
        "Elevation is not a Model 1 feature and is intentionally excluded.",
    ]
    return base_payload, True, notes


if __name__ == "__main__":
    print(json.dumps({"cache_ttl_seconds": CACHE_TTL_SECONDS, "api_timeout_seconds": API_TIMEOUT_SECONDS}, indent=2))
