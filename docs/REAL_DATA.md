# PRAVAAH Real Data and Prototype Status

## Data providers

- Open-Meteo Forecast API for precipitation, rainfall forecasts, and soil moisture context.
- Open-Meteo Elevation API for terrain elevation at the selected latitude and longitude.
- Repository static Model 2 configuration and model definitions for the landslide susceptibility architecture.

## Endpoints used

- https://api.open-meteo.com/v1/forecast
- https://api.open-meteo.com/v1/elevation

## Variables used

- precipitation_sum: observed daily rainfall totals in mm.
- precipitation: hourly rainfall for forecast context in mm.
- soil_moisture_0_7cm: ERA5-Land surface soil moisture proxy in m3/m3.
- elevation: terrain elevation in metres.

## Historical rainfall calculation

- rain_1d: last available observed daily precipitation total.
- rain_3d: sum of the last three observed daily precipitation totals.
- rain_15d: sum of the last fifteen observed daily precipitation totals.
- These are calculated from daily weather observations and are not based on the current hour value alone.

## Forecast rainfall calculation

- forecast_24h: sum of the next 24 hourly precipitation values.
- forecast_3d: sum of the next three forecast daily precipitation totals.
- Forecast rainfall is reported separately from historical observations and is used as context rather than a historical trigger.

## Soil moisture source

Open-Meteo soil moisture values come from the ERA5-Land soil_moisture_0_7cm product. This is not a SMAP dataset and is reported accurately as such in the API response metadata.

## Elevation source

The elevation value is retrieved from the Open-Meteo elevation endpoint, which returns the terrain height at the selected coordinates.

## Caching

- Backend cache is an in-memory request cache keyed by provider, latitude, longitude, and data window.
- TTL is controlled by the environment variable PRAVAAH_CACHE_TTL_SECONDS.
- Default TTL: 300 seconds.

## Limitations

- PRAVAAH remains a prototype early-warning dashboard, not a validated operational warning system.
- The legacy Model 1 is trained on synthetic prototype data.
- The static landslide susceptibility component is not backed by a geospatial location lookup in this repository, so the backend reports it as unavailable for a real location-based static susceptibility score unless a matching static raster or lookup layer is added later.
- The dynamic risk engine weights are prototype rules and require calibration against verified historical landslide events.

## What is real

- Actual precipitation observations and forecasts from Open-Meteo.
- Actual soil moisture and elevation values from Open-Meteo APIs.
- Actual location-based input path from the frontend through the backend risk endpoint.

## What remains prototype

- Model 1 flood probability output.
- Model 2 static susceptibility lookup.
- Dynamic risk thresholds and rainfall normalization parameters.
- Risk categories and trigger weights remain project prototype rules rather than validated operational thresholds.
