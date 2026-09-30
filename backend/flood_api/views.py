import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from models.model1 import HORIZON_HOURS, predict
from .models import RiskEvaluation, Alert

from . import risk_engine as risk_engine_module


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def model1_predict(request):
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=204)
        return _add_cors_headers(response, request)
    try:
        payload = json.loads(request.body)
    except (TypeError, ValueError):
        return _add_cors_headers(
            JsonResponse({"error": "Request body must be valid JSON."}, status=400), request
        )
    if not isinstance(payload, dict):
        return _add_cors_headers(
            JsonResponse({"error": "Request body must be a JSON object."}, status=400), request
        )
    try:
        probability = predict(payload)
    except ValueError as exc:
        return _add_cors_headers(JsonResponse({"error": str(exc)}, status=400), request)
    except RuntimeError as exc:
        return _add_cors_headers(JsonResponse({"error": str(exc)}, status=503), request)
    return _add_cors_headers(JsonResponse(
        {
            "flood_probability": probability,
            "prediction_horizon_hours": HORIZON_HOURS,
        }
    ), request)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def risk_engine(request):
    if request.method == "OPTIONS":
        response = JsonResponse({}, status=204)
        return _add_cors_headers(response, request)

    try:
        payload = json.loads(request.body)
    except (TypeError, ValueError):
        return _add_cors_headers(
            JsonResponse({"error": "Request body must be valid JSON."}, status=400), request
        )
    if not isinstance(payload, dict):
        return _add_cors_headers(
            JsonResponse({"error": "Request body must be a JSON object."}, status=400), request
        )

    try:
        latitude, longitude = risk_engine_module._validate_coordinates(payload.get("latitude"), payload.get("longitude"))
    except ValueError as exc:
        return _add_cors_headers(JsonResponse({"error": str(exc)}, status=400), request)

    try:
        rainfall = risk_engine_module.fetch_rainfall(latitude, longitude)
    except Exception as exc:
        return _add_cors_headers(JsonResponse({"error": f"Open-Meteo rainfall data unavailable: {exc}"}, status=502), request)

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


    # Save RiskEvaluation
    try:
        RiskEvaluation.objects.create(
            latitude=latitude,
            longitude=longitude,
            risk_score=risk.get("current_landslide_risk"),
            risk_category=risk.get("risk_category"),
            rainfall_1d=rainfall.get("rain_1d", {}).get("value") if isinstance(rainfall, dict) else None,
            rainfall_3d=rainfall.get("rain_3d", {}).get("value") if isinstance(rainfall, dict) else None,
            rainfall_15d=rainfall.get("rain_15d", {}).get("value") if isinstance(rainfall, dict) else None,
            soil_moisture=soil_moisture.get("value") if isinstance(soil_moisture, dict) else None,
            elevation=elevation.get("value") if isinstance(elevation, dict) else None,
        )
    except Exception as e:
        print("Failed to save risk evaluation:", e)

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
    return _add_cors_headers(JsonResponse(body, status=200), request)


def _add_cors_headers(response, request=None):
    origin = "*"
    if request and "HTTP_ORIGIN" in request.META:
        origin = request.META["HTTP_ORIGIN"]
    
    response["Access-Control-Allow-Origin"] = origin
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def risk_history(request):
    if request.method == "OPTIONS":
        return _add_cors_headers(JsonResponse({}, status=204), request)
    
    lat = request.GET.get("latitude")
    lon = request.GET.get("longitude")
    if not lat or not lon:
        return _add_cors_headers(JsonResponse({"error": "Latitude and longitude required."}, status=400), request)
    
    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return _add_cors_headers(JsonResponse({"error": "Invalid coordinates."}, status=400), request)
        
    # very simple distance matching, assuming exact coordinates for demo
    qs = RiskEvaluation.objects.filter(
        latitude__gte=lat-0.05, latitude__lte=lat+0.05,
        longitude__gte=lon-0.05, longitude__lte=lon+0.05
    ).order_by('-created_at')[:20]
    
    data = []
    for r in qs:
        data.append({
            "id": r.id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "risk_score": r.risk_score,
            "risk_category": r.risk_category,
            "rainfall_1d": r.rainfall_1d,
            "soil_moisture": r.soil_moisture,
            "created_at": r.created_at.isoformat(),
        })
    return _add_cors_headers(JsonResponse(data, safe=False), request)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def alerts(request):
    if request.method == "OPTIONS":
        return _add_cors_headers(JsonResponse({}, status=204), request)
        
    if request.method == "GET":
        qs = Alert.objects.order_by('-created_at')[:50]
        data = []
        for a in qs:
            data.append({
                "id": a.id,
                "location_name": a.location_name,
                "latitude": a.latitude,
                "longitude": a.longitude,
                "risk_category": a.risk_category,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "authority": a.authority,
                "created_at": a.created_at.isoformat(),
            })
        return _add_cors_headers(JsonResponse(data, safe=False), request)
        
    if request.method == "POST":
        try:
            payload = json.loads(request.body)
        except (TypeError, ValueError):
            return _add_cors_headers(JsonResponse({"error": "Invalid JSON."}, status=400), request)
            
        alert = Alert.objects.create(
            location_name=payload.get("location_name"),
            latitude=payload.get("latitude"),
            longitude=payload.get("longitude"),
            risk_category=payload.get("risk_category"),
            alert_type=payload.get("alert_type"),
            severity=payload.get("severity"),
            message=payload.get("message"),
            authority=payload.get("authority", "System")
        )
        return _add_cors_headers(JsonResponse({"success": True, "id": alert.id}), request)
