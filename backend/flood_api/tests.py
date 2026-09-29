import json
from unittest.mock import patch

from django.test import Client, TestCase, SimpleTestCase

from models.model1 import FEATURES, HORIZON_HOURS
from flood_api.models import RiskEvaluation, Alert


class Model1ApiTests(SimpleTestCase):
    def setUp(self):
        self.client = Client()
        self.payload = {feature: 1 for feature in FEATURES}

    def test_prediction_returns_probability_and_three_hour_horizon(self):
        response = self.client.post(
            "/api/model1/predict",
            data=json.dumps(self.payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("flood_probability", body)
        self.assertEqual(body["prediction_horizon_hours"], HORIZON_HOURS)
        self.assertGreaterEqual(body["flood_probability"], 0)
        self.assertLessEqual(body["flood_probability"], 1)

    def test_missing_feature_is_rejected(self):
        payload = dict(self.payload)
        payload.pop("rain_1h")
        response = self.client.post(
            "/api/model1/predict",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("rain_1h", response.json()["error"])

    def test_non_json_body_is_rejected(self):
        response = self.client.post(
            "/api/model1/predict", data="not-json", content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_browser_preflight_is_allowed(self):
        response = self.client.options(
            "/api/model1/predict",
            HTTP_ORIGIN="http://127.0.0.1:5500",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="Content-Type",
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(
            response["Access-Control-Allow-Origin"], "http://127.0.0.1:5500"
        )


MOCK_RAIN = {
    "status": "available",
    "rain_1d": {"value": 12.0, "unit": "mm"},
    "rain_3d": {"value": 36.0, "unit": "mm"},
    "rain_15d": {"value": 120.0, "unit": "mm"},
    "forecast_24h": {"value": 18.0, "unit": "mm"},
    "forecast_3d": {"value": 42.0, "unit": "mm"},
    "source": "Open-Meteo",
}
MOCK_SOIL = {"status": "available", "value": 0.2, "unit": "m3/m3", "source": "Open-Meteo"}
MOCK_ELEVATION = {"status": "available", "value": 1200.0, "unit": "m", "source": "Open-Meteo Elevation API"}
MOCK_STATIC = {"status": "available", "value": 0.5, "unit": "probability", "source": "Repository static susceptibility lookup"}


class RiskEngineApiTests(TestCase):
    databases = ['default']

    def setUp(self):
        self.client = Client()
        self.payload = {"latitude": 30.674, "longitude": 78.483}

    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_elevation")
    @patch("flood_api.risk_engine.get_static_susceptibility")
    def test_valid_coordinates_return_risk_payload(self, mock_static, mock_elevation, mock_soil, mock_rain):
        mock_rain.return_value = MOCK_RAIN
        mock_soil.return_value = MOCK_SOIL
        mock_elevation.return_value = MOCK_ELEVATION
        mock_static.return_value = MOCK_STATIC

        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("rainfall", body)
        self.assertIn("soil_moisture", body)
        self.assertIn("elevation", body)
        self.assertIn("current_landslide_risk", body)

    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_elevation")
    @patch("flood_api.risk_engine.get_static_susceptibility")
    def test_invalid_coordinates_are_rejected(self, mock_static, mock_elevation, mock_soil, mock_rain):
        for bad in [{"latitude": 999, "longitude": 78.4}, {"latitude": "abc", "longitude": 78.4}]:
            response = self.client.post(
                "/api/risk-engine/",
                data=json.dumps(bad),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 400)

    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_elevation")
    @patch("flood_api.risk_engine.get_static_susceptibility")
    def test_api_timeout_is_reported(self, mock_static, mock_elevation, mock_soil, mock_rain):
        import requests
        mock_rain.side_effect = requests.Timeout("Request timed out")
        mock_soil.return_value = MOCK_SOIL
        mock_elevation.return_value = MOCK_ELEVATION
        mock_static.return_value = MOCK_STATIC

        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 502)
        self.assertIn("timed out", response.json()["error"].lower())


class RiskHistoryApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        RiskEvaluation.objects.create(latitude=30.674, longitude=78.483, risk_score=0.6, risk_category="High", rainfall_1d=22)
        RiskEvaluation.objects.create(latitude=30.674, longitude=78.483, risk_score=0.4, risk_category="Moderate", rainfall_1d=10)

    def test_history_returns_records_for_location(self):
        response = self.client.get("/api/risk-history/?latitude=30.674&longitude=78.483")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(len(data), 2)
        self.assertIn("risk_score", data[0])
        self.assertIn("risk_category", data[0])
        self.assertIn("created_at", data[0])

    def test_history_missing_coords_returns_400(self):
        response = self.client.get("/api/risk-history/")
        self.assertEqual(response.status_code, 400)

    def test_history_invalid_coords_returns_400(self):
        response = self.client.get("/api/risk-history/?latitude=abc&longitude=78.483")
        self.assertEqual(response.status_code, 400)


class AlertApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_create_alert(self):
        payload = {
            "location_name": "Dharali",
            "latitude": 30.674,
            "longitude": 78.483,
            "alert_type": "Flood",
            "severity": "High",
            "message": "Flash flood risk increasing.",
        }
        response = self.client.post(
            "/api/alerts/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertIn("id", body)

    def test_get_alerts(self):
        Alert.objects.create(alert_type="Weather", severity="Moderate", message="Heavy rain expected.")
        response = self.client.get("/api/alerts/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        self.assertIn("alert_type", data[0])
        self.assertIn("created_at", data[0])

    def test_create_alert_persists_to_db(self):
        payload = {
            "location_name": "Kedarpur",
            "alert_type": "Landslide",
            "severity": "Critical",
            "message": "Slope movement detected.",
        }
        self.client.post("/api/alerts/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(Alert.objects.filter(location_name="Kedarpur").count(), 1)
