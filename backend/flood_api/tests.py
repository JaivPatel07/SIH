import json
from unittest.mock import patch

from django.test import Client, SimpleTestCase

from models.model1 import FEATURES, HORIZON_HOURS


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


class RiskEngineApiTests(SimpleTestCase):
    def setUp(self):
        self.client = Client()
        self.payload = {"latitude": 30.674, "longitude": 78.483}

    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_elevation")
    @patch("flood_api.risk_engine.get_static_susceptibility")
    def test_valid_coordinates_return_risk_payload(
        self,
        mock_static,
        mock_elevation,
        mock_soil,
        mock_rain,
    ):
        mock_rain.return_value = {
            "status": "available",
            "rain_1d": {"value": 12.0, "unit": "mm"},
            "rain_3d": {"value": 36.0, "unit": "mm"},
            "rain_15d": {"value": 120.0, "unit": "mm"},
            "forecast_24h": {"value": 18.0, "unit": "mm"},
            "forecast_3d": {"value": 42.0, "unit": "mm"},
            "source": "Open-Meteo",
            "observed_at": "2026-09-29T00:00:00Z",
            "retrieved_at": "2026-09-29T12:00:00Z",
        }
        mock_soil.return_value = {
            "status": "available",
            "value": 0.28,
            "unit": "m3/m3",
            "source": "Open-Meteo (ERA5-Land soil_moisture_0_7cm)",
            "observed_at": "2026-09-29T12:00:00Z",
            "retrieved_at": "2026-09-29T12:00:00Z",
        }
        mock_elevation.return_value = {
            "status": "available",
            "value": 1280.0,
            "unit": "m",
            "source": "Open-Meteo Elevation API",
            "retrieved_at": "2026-09-29T12:00:00Z",
        }
        mock_static.return_value = {
            "status": "available",
            "value": 0.62,
            "unit": "probability",
            "source": "Repository static susceptibility lookup",
            "retrieved_at": "2026-09-29T12:00:00Z",
        }

        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["latitude"], 30.674)
        self.assertEqual(body["longitude"], 78.483)
        self.assertIn("rainfall", body)
        self.assertIn("soil_moisture", body)
        self.assertIn("static_susceptibility", body)
        self.assertIn("current_landslide_risk", body)

    def test_invalid_latitude_is_rejected(self):
        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps({"latitude": 91, "longitude": 78.483}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude", response.json()["error"])

    def test_invalid_longitude_is_rejected(self):
        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps({"latitude": 30.674, "longitude": 181}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("longitude", response.json()["error"])

    @patch("flood_api.risk_engine.fetch_rainfall")
    def test_weather_api_failure_returns_data_unavailable(self, mock_rain):
        mock_rain.side_effect = RuntimeError("Open-Meteo weather request failed")
        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 502)
        self.assertIn("Open-Meteo", response.json()["error"])

    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.fetch_elevation")
    @patch("flood_api.risk_engine.get_static_susceptibility")
    def test_soil_moisture_failure_sets_unavailable_status(
        self,
        mock_static,
        mock_elevation,
        mock_rain,
        mock_soil,
    ):
        mock_rain.return_value = {"status": "available", "rain_1d": {"value": 1.0, "unit": "mm"}, "rain_3d": {"value": 3.0, "unit": "mm"}, "rain_15d": {"value": 15.0, "unit": "mm"}, "forecast_24h": {"value": 2.0, "unit": "mm"}, "forecast_3d": {"value": 6.0, "unit": "mm"}, "source": "Open-Meteo"}
        mock_elevation.return_value = {"status": "available", "value": 1200.0, "unit": "m", "source": "Open-Meteo Elevation API"}
        mock_static.return_value = {"status": "available", "value": 0.5, "unit": "probability", "source": "Repository static susceptibility lookup"}
        mock_soil.side_effect = RuntimeError("Soil moisture provider unavailable")

        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["soil_moisture"]["status"], "unavailable")

    @patch("flood_api.risk_engine.fetch_elevation")
    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.get_static_susceptibility")
    def test_elevation_failure_sets_unavailable_status(
        self,
        mock_static,
        mock_rain,
        mock_soil,
        mock_elevation,
    ):
        mock_static.return_value = {"status": "available", "value": 0.5, "unit": "probability", "source": "Repository static susceptibility lookup"}
        mock_rain.return_value = {"status": "available", "rain_1d": {"value": 1.0, "unit": "mm"}, "rain_3d": {"value": 3.0, "unit": "mm"}, "rain_15d": {"value": 15.0, "unit": "mm"}, "forecast_24h": {"value": 2.0, "unit": "mm"}, "forecast_3d": {"value": 6.0, "unit": "mm"}, "source": "Open-Meteo"}
        mock_soil.return_value = {"status": "available", "value": 0.2, "unit": "m3/m3", "source": "Open-Meteo"}
        mock_elevation.side_effect = RuntimeError("Elevation provider unavailable")

        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["elevation"]["status"], "unavailable")

    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_elevation")
    @patch("flood_api.risk_engine.get_static_susceptibility")
    def test_risk_calculation_uses_static_score_and_dynamic_trigger(
        self,
        mock_static,
        mock_elevation,
        mock_soil,
        mock_rain,
    ):
        mock_rain.return_value = {
            "status": "available",
            "rain_1d": {"value": 10.0, "unit": "mm"},
            "rain_3d": {"value": 18.0, "unit": "mm"},
            "rain_15d": {"value": 30.0, "unit": "mm"},
            "source": "Open-Meteo",
            "forecast_24h": {"value": 20.0, "unit": "mm"},
            "forecast_3d": {"value": 40.0, "unit": "mm"},
        }
        mock_soil.return_value = {"status": "available", "value": 0.5, "unit": "m3/m3", "source": "Open-Meteo"}
        mock_elevation.return_value = {"status": "available", "value": 1300.0, "unit": "m", "source": "Open-Meteo Elevation API"}
        mock_static.return_value = {"status": "available", "value": 0.5, "unit": "probability", "source": "Repository static susceptibility lookup"}

        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertGreaterEqual(body["current_landslide_risk"], 0.0)
        self.assertLessEqual(body["current_landslide_risk"], 1.0)
        self.assertIn(body["risk_category"], {"Low", "Moderate", "High", "Very High"})

    @patch("flood_api.risk_engine.get_static_susceptibility")
    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_elevation")
    def test_missing_static_susceptibility_is_reported(
        self,
        mock_elevation,
        mock_soil,
        mock_rain,
        mock_static,
    ):
        mock_static.return_value = {"status": "static_susceptibility_unavailable"}
        mock_rain.return_value = {"status": "available", "rain_1d": {"value": 1.0, "unit": "mm"}, "rain_3d": {"value": 3.0, "unit": "mm"}, "rain_15d": {"value": 15.0, "unit": "mm"}, "forecast_24h": {"value": 2.0, "unit": "mm"}, "forecast_3d": {"value": 6.0, "unit": "mm"}, "source": "Open-Meteo"}
        mock_soil.return_value = {"status": "available", "value": 0.2, "unit": "m3/m3", "source": "Open-Meteo"}
        mock_elevation.return_value = {"status": "available", "value": 1200.0, "unit": "m", "source": "Open-Meteo Elevation API"}

        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["static_susceptibility"]["status"],
            "static_susceptibility_unavailable",
        )

    @patch("flood_api.risk_engine.fetch_rainfall")
    @patch("flood_api.risk_engine.fetch_soil_moisture")
    @patch("flood_api.risk_engine.fetch_elevation")
    @patch("flood_api.risk_engine.get_static_susceptibility")
    def test_api_timeout_is_reported(
        self,
        mock_static,
        mock_elevation,
        mock_soil,
        mock_rain,
    ):
        import requests

        mock_rain.side_effect = requests.Timeout("Request timed out")
        mock_soil.return_value = {"status": "available", "value": 0.2, "unit": "m3/m3", "source": "Open-Meteo"}
        mock_elevation.return_value = {"status": "available", "value": 1200.0, "unit": "m", "source": "Open-Meteo Elevation API"}
        mock_static.return_value = {"status": "available", "value": 0.5, "unit": "probability", "source": "Repository static susceptibility lookup"}

        response = self.client.post(
            "/api/risk-engine/",
            data=json.dumps(self.payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn("timed out", response.json()["error"].lower())
