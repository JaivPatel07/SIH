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

## SIH Round 1 — Model 2

Model 2 predicts a numeric landslide susceptibility score for a geographic cell using terrain, soil, land-cover, vegetation, and historical rainfall features. The static model returns only `landslide_susceptibility`; current rainfall and soil-moisture conditions are handled separately by a dynamic risk engine.

## Run

```cmd
cd SIH_Round1
python -m venv .venv-model2
.venv-model2\Scripts\activate
python -m pip install -r models\model2\requirements.txt
python -m models.model2.predictor
```

The prediction requires numeric values for all 17 static features:

`elevation`, `slope`, `aspect_sin`, `aspect_cos`, `curvature`, `upstream_area`, `TWI`, `drainage_density`, `distance_to_drainage`, `clay_surface`, `organic_carbon_surface`, `landcover`, `NDVI`, `mean_annual_rainfall`, `max_daily_rainfall`, `mean_monsoon_rainfall`, and `high_rain_days`.

Current rainfall and soil moisture are not used as static model features; they are handled separately by the dynamic risk engine.

Example response:

```json
{"landslide_susceptibility": 0.283}
```

The static susceptibility score is returned from `0` to `1`, with a configured classification threshold of `0.40`. The final model is a Random Forest classifier trained using historical landslide inventory and environmental/geospatial data for Uttarakhand.

The Model 2 artifacts use scikit-learn `1.6.1`; the pinned dependency is provided in `models\model2\requirements.txt`.

The dynamic risk engine combines static susceptibility with recent rainfall and soil-moisture conditions to calculate current landslide risk. The susceptibility threshold and dynamic risk rules are prototype configurations and require further validation before operational warning use.