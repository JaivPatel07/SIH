from django.db import models

class RiskEvaluation(models.Model):
    latitude = models.FloatField()
    longitude = models.FloatField()
    risk_score = models.FloatField(null=True, blank=True)
    risk_category = models.CharField(max_length=50, null=True, blank=True)
    rainfall_1d = models.FloatField(null=True, blank=True)
    rainfall_3d = models.FloatField(null=True, blank=True)
    rainfall_15d = models.FloatField(null=True, blank=True)
    soil_moisture = models.FloatField(null=True, blank=True)
    elevation = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Alert(models.Model):
    location_name = models.CharField(max_length=255, null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    risk_category = models.CharField(max_length=50, null=True, blank=True)
    alert_type = models.CharField(max_length=100)
    severity = models.CharField(max_length=50)
    message = models.TextField()
    authority = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
