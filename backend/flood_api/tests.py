import json

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
