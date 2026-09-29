import { createContext, useContext, useState, useEffect } from "react";
import { fetchRiskEngine, type RiskEngineResponse, fetchRiskHistory, type RiskHistoryEntry } from "../services/riskEngineService";

export type Location = {
  name: string;
  latitude: number;
  longitude: number;
};

type RiskContextType = {
  selectedLocation: Location;
  setSelectedLocation: (loc: Location) => void;
  isLocationSet: boolean;
  setIsLocationSet: (val: boolean) => void;
  riskData: RiskEngineResponse | null;
  historyData: RiskHistoryEntry[];
  loading: boolean;
  error: string | null;
  refreshRiskData: () => Promise<void>;
};

const defaultLocation: Location = { name: "Dharali", latitude: 30.6739, longitude: 78.4827 };

const RiskContext = createContext<RiskContextType | undefined>(undefined);

export function RiskProvider({ children }: { children: React.ReactNode }) {
  const [selectedLocation, setSelectedLocationState] = useState<Location>(() => {
    const saved = localStorage.getItem("pravaah_loc");
    return saved ? JSON.parse(saved) : defaultLocation;
  });
  const [isLocationSet, setIsLocationSet] = useState<boolean>(() => {
    return !!localStorage.getItem("pravaah_loc");
  });
  const [riskData, setRiskData] = useState<RiskEngineResponse | null>(null);
  const [historyData, setHistoryData] = useState<RiskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSelectedLocation = (loc: Location) => {
    setSelectedLocationState(loc);
    setIsLocationSet(true);
    localStorage.setItem("pravaah_loc", JSON.stringify(loc));
  };

  const refreshRiskData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRiskEngine(selectedLocation.latitude, selectedLocation.longitude);
      const hist = await fetchRiskHistory(selectedLocation.latitude, selectedLocation.longitude).catch(() => []);
      setHistoryData(hist);
      setRiskData(data);
    } catch (err: any) {
      setError(err.message || "Risk assessment unavailable for this location.");
      setRiskData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLocationSet || selectedLocation === defaultLocation) {
      refreshRiskData();
    }
  }, [selectedLocation, isLocationSet]);

  return (
    <RiskContext.Provider value={{ selectedLocation, setSelectedLocation, isLocationSet, setIsLocationSet, riskData, historyData, loading, error, refreshRiskData }}>
      {children}
    </RiskContext.Provider>
  );
}

export function useRisk() {
  const ctx = useContext(RiskContext);
  if (!ctx) throw new Error("useRisk must be used within a RiskProvider");
  return ctx;
}
