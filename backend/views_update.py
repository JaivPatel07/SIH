import json

with open(r'c:\Users\nishi\Desktop\jaiv\github\SIH\backend\flood_api\views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
if 'from .models import RiskEvaluation, Alert' not in content:
    content = content.replace(
        'from models.model1 import HORIZON_HOURS, predict',
        'from models.model1 import HORIZON_HOURS, predict\nfrom .models import RiskEvaluation, Alert'
    )

# Add saving RiskEvaluation
risk_save_code = """
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

    body = {"""
content = content.replace('    body = {', risk_save_code)

# Add new views
new_views = """
@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def risk_history(request):
    if request.method == "OPTIONS":
        return _add_cors_headers(JsonResponse({}, status=204))
    
    lat = request.GET.get("latitude")
    lon = request.GET.get("longitude")
    if not lat or not lon:
        return _add_cors_headers(JsonResponse({"error": "Latitude and longitude required."}, status=400))
    
    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return _add_cors_headers(JsonResponse({"error": "Invalid coordinates."}, status=400))
        
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
    return _add_cors_headers(JsonResponse(data, safe=False))


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def alerts(request):
    if request.method == "OPTIONS":
        return _add_cors_headers(JsonResponse({}, status=204))
        
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
        return _add_cors_headers(JsonResponse(data, safe=False))
        
    if request.method == "POST":
        try:
            payload = json.loads(request.body)
        except (TypeError, ValueError):
            return _add_cors_headers(JsonResponse({"error": "Invalid JSON."}, status=400))
            
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
        return _add_cors_headers(JsonResponse({"success": True, "id": alert.id}))
"""

content += new_views

with open(r'c:\Users\nishi\Desktop\jaiv\github\SIH\backend\flood_api\views.py', 'w', encoding='utf-8') as f:
    f.write(content)
