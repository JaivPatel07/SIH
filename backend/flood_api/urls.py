from django.urls import path

from .views import model1_predict


urlpatterns = [path("model1/predict", model1_predict, name="model1-predict")]
