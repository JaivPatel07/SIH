export type RiskMetric = {
  value: number | null;
  unit: string;
  source: string;
  observed_at?: string | null;
  retrieved_at?: string | null;
  status: string;
};

export type RiskEngineResponse = {
  latitude: number;
  longitude: number;
  rainfall: {
    status: string;
    source: string;
    observed_at?: string | null;
    retrieved_at?: string | null;
    rain_1d?: RiskMetric;
    rain_3d?: RiskMetric;
    rain_15d?: RiskMetric;
    forecast_24h?: RiskMetric;
    forecast_3d?: RiskMetric;
  };
  soil_moisture: RiskMetric;
  elevation: RiskMetric;
  static_susceptibility: RiskMetric & { note?: string };
  dynamic_trigger_score?: number | null;
  current_landslide_risk?: number | null;
  risk_category?: string | null;
  risk_explanation?: {
    summary: string;
    drivers: string[];
    confidence: string;
    data_sources: string[];
    category: string;
  };
  model1?: {
    prototype_mode: boolean;
    flood_probability?: number | null;
    prediction_horizon_hours?: number | null;
    notes?: string[];
    feature_payload?: Record<string, number>;
  };
  prototype_notes?: string[];
};

export const operationalRisk = {
  classification: "High",
  window: "3–6 hrs",
  explanation: "Operational classification from flood probability, dynamic landslide risk, and live conditions.",
};

export async function fetchRiskEngine(latitude: number, longitude: number): Promise<RiskEngineResponse> {
  const API_BASE = `http://${window.location.hostname}:8000`;
  const response = await fetch(`${API_BASE}/api/risk-engine/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Unable to fetch risk data.");
  }

  return response.json();
}

export type RiskHistoryEntry = {
  id: number;
  latitude: number;
  longitude: number;
  risk_score: number | null;
  risk_category: string | null;
  rainfall_1d: number | null;
  soil_moisture: number | null;
  created_at: string;
};

export async function fetchRiskHistory(latitude: number, longitude: number): Promise<RiskHistoryEntry[]> {
  const API_BASE = `http://${window.location.hostname}:8000`;
  const response = await fetch(`${API_BASE}/api/risk-history/?latitude=${latitude}&longitude=${longitude}`);
  if (!response.ok) {
    throw new Error("Unable to fetch risk history.");
  }
  return response.json();
}

export type AlertRecord = {
  id?: number;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  risk_category?: string;
  alert_type: string;
  severity: string;
  message: string;
  authority?: string;
  created_at?: string;
};

export async function fetchAlerts(): Promise<AlertRecord[]> {
  const API_BASE = `http://${window.location.hostname}:8000`;
  const response = await fetch(`${API_BASE}/api/alerts/`);
  if (!response.ok) {
    throw new Error("Unable to fetch alerts.");
  }
  return response.json();
}

export async function createAlert(alert: AlertRecord): Promise<{ success: boolean; id: number }> {
  const response = await fetch("http://127.0.0.1:8000/api/alerts/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alert),
  });
  if (!response.ok) {
    throw new Error("Unable to create alert.");
  }
  return response.json();
}
