"""Model 1: three-hour flash-flood probability model."""

from .predictor import FEATURES, HORIZON_HOURS, predict

__all__ = ["FEATURES", "HORIZON_HOURS", "predict"]
