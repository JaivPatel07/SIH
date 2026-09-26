import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from models.model1 import HORIZON_HOURS, predict


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


def _add_cors_headers(response):
    response["Access-Control-Allow-Origin"] = "http://127.0.0.1:5500"
    response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response
