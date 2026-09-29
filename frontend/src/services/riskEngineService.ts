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
  const response = await fetch("http://127.0.0.1:8000/api/risk-engine/", {
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
