# SIH Round 1 — Django Model 1

Model 1 predicts a numeric flash-flood probability for the next three hours.
The API intentionally returns only `flood_probability`; alert decisions belong
to a separate risk engine.

## Run

```cmd
cd SIH_Round1
python -m pip install -r backend\requirements.txt
python models\model1\train_model1.py
python backend\manage.py runserver
```

The prediction endpoint is `POST http://127.0.0.1:8000/api/model1/predict`.
The request must contain numeric values for all features listed below:

`rain_1h`, `rain_3h`, `rain_6h`, `rain_24h`, `rain_72h`,
`max_rain_intensity`, `rainfall_rate`, `soil_moisture`,
`soil_moisture_change`, `slope`, `flow_accumulation`, `distance_to_river`,
`twi`, and `historical_flood_count`.

The MVP intentionally excludes redundant rainfall windows and lower-priority
GIS/context fields such as aspect, curvature, drainage density, land cover,
soil type, elevation, and antecedent precipitation.

Example response:

```json
{"flood_probability": 0.87, "prediction_horizon_hours": 3}
```

The checked-in artifact is a reproducible prototype trained on synthetic data.
Replace it with verified historical environmental/event data before operational
use. The six-hour DHARA reference artifact is retained but is not used.
