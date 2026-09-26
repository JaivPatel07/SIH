from django.urls import include, path


urlpatterns = [path("api/", include("flood_api.urls"))]
