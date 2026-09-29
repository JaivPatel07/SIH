from django.urls import path

from .views import model1_predict, risk_engine, risk_history, alerts

urlpatterns = [
    path("model1/predict", model1_predict, name="model1-predict"),
    path("risk-engine/", risk_engine, name="risk-engine"),
    path("risk-history/", risk_history, name="risk-history"),
    path("alerts/", alerts, name="alerts"),
]
