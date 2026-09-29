from django.urls import path

from .views import model1_predict, risk_engine


urlpatterns = [
    path("model1/predict", model1_predict, name="model1-predict"),
    path("risk-engine/", risk_engine, name="risk-engine"),
]
