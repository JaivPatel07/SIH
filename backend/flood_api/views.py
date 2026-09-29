import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from models.model1 import HORIZON_HOURS, predict

from . import risk_engine as risk_engine_module


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def model1_predict(request):
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=204)
        return _add_cors_headers(response)
    try:
        payload = json.loads(request.body)
    except (TypeError, ValueError):
        return _add_cors_headers(
            JsonResponse({"error": "Request body must be valid JSON."}, status=400)
        )
    if not isinstance(payload, dict):
        return _add_cors_headers(
            JsonResponse({"error": "Request body must be a JSON object."}, status=400)
        )
    try:
        probability = predict(payload)
    except ValueError as exc:
        return _add_cors_headers(JsonResponse({"error": str(exc)}, status=400))
    except RuntimeError as exc:
        return _add_cors_headers(JsonResponse({"error": str(exc)}, status=503))
    return _add_cors_headers(JsonResponse(
        {
            "flood_probability": probability,
            "prediction_horizon_hours": HORIZON_HOURS,
        }
    ))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def risk_engine(request):
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=204)
        return _add_cors_headers(response)

    try:
        payload = json.loads(request.body)
    except (TypeError, ValueError):
        return _add_cors_headers(
            JsonResponse({"error": "Request body must be valid JSON."}, status=400)
        )
    if not isinstance(payload, dict):
        return _add_cors_headers(
            JsonResponse({"error": "Request body must be a JSON object."}, status=400)
        )

    try:
        latitude, longitude = risk_engine_module._validate_coordinates(payload.get("latitude"), payload.get("longitude"))
    except ValueError as exc:
        return _add_cors_headers(JsonResponse({"error": str(exc)}, status=400))

    try:
        rainfall = risk_engine_module.fetch_rainfall(latitude, longitude)
    except Exception as exc:
        return _add_cors_headers(JsonResponse({"error": f"Open-Meteo rainfall data unavailable: {exc}"}, status=502))

    try:
        soil_moisture = risk_engine_module.fetch_soil_moisture(latitude, longitude)
    except Exception as exc:
        soil_moisture = {
            "value": None,
            "unit": "m3/m3",
            "source": "Open-Meteo (ERA5-Land soil_moisture_0_7cm)",
            "observed_at": None,
            "retrieved_at": None,
            "status": "unavailable",
            "error": str(exc),
        }

    try:
        elevation = risk_engine_module.fetch_elevation(latitude, longitude)
    except Exception as exc:
        elevation = {
            "value": None,
            "unit": "m",
            "source": "Open-Meteo Elevation API",
            "retrieved_at": None,
            "status": "unavailable",
            "error": str(exc),
        }

    static_susceptibility = risk_engine_module.get_static_susceptibility(latitude, longitude)
    risk = risk_engine_module.calculate_landslide_risk(static_susceptibility, rainfall, soil_moisture)
    risk_explanation = risk_engine_module.build_risk_explanation(
        static_susceptibility,
        rainfall,
        soil_moisture,
        risk.get("current_landslide_risk"),
    )

    model1_payload, prototype_mode, model1_notes = risk_engine_module.build_model1_payload(rainfall, soil_moisture, elevation)
    flood_probability = None
    try:
        flood_probability = predict(model1_payload)
    except ValueError:
        flood_probability = None
    except RuntimeError:
        flood_probability = None

    body = {
        "latitude": latitude,
        "longitude": longitude,
        "rainfall": rainfall,
        "soil_moisture": soil_moisture,
        "elevation": elevation,
        "static_susceptibility": static_susceptibility,
        "dynamic_trigger_score": risk.get("dynamic_trigger_score"),
        "current_landslide_risk": risk.get("current_landslide_risk"),
        "risk_category": risk.get("risk_category"),
        "risk_explanation": risk_explanation,
        "model1": {
            "prototype_mode": prototype_mode,
            "flood_probability": flood_probability,
            "prediction_horizon_hours": HORIZON_HOURS,
            "notes": model1_notes,
            "feature_payload": model1_payload,
        },
        "prototype_notes": [
            "This is a prototype risk engine using real online environmental inputs and project-defined prototype trigger weights.",
            "Static susceptibility is only returned when a static susceptibility layer is available for the selected location.",
            "Model 1 remains prototype/synthetic and may not be operationally validated.",
        ],
    }
    return _add_cors_headers(JsonResponse(body, status=200))


def _add_cors_headers(response):
    allowed_origins = {
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    }
    origin = response.headers.get("Origin") or ""
    allowed_origin = origin if origin in allowed_origins else "http://127.0.0.1:5500"
    response["Access-Control-Allow-Origin"] = allowed_origin
    response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response
