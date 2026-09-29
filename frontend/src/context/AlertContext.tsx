import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchAlerts, createAlert as postAlert, type AlertRecord } from "../services/riskEngineService";

export type AlertType = "Flood" | "Landslide" | "Weather" | "Evacuation" | "General Warning";
export type AlertSeverity = "Advisory" | "Warning" | "Emergency" | "Moderate" | "High" | "Critical";

export type PravaahAlert = {
  id: string;
  area: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  action: string;
  timestamp: string;
  sentBy: "authority";
  fresh?: boolean;
};

type AlertInput = Omit<PravaahAlert, "id" | "timestamp" | "sentBy" | "fresh">;

type AlertContextValue = {
  alerts: PravaahAlert[];
  unread: number;
  sentCount: number;
  latestAlert: PravaahAlert | null;
  sendAlert: (alert: AlertInput) => Promise<PravaahAlert>;
  markAllRead: () => void;
  refreshAlerts: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<PravaahAlert[]>([]);
  const [unread, setUnread] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  const refreshAlerts = () => {
    fetchAlerts().then(data => {
      const formatted: PravaahAlert[] = data.map(a => ({
        id: `alert-${a.id}`,
        area: a.location_name || "Unknown",
        type: (a.alert_type as AlertType) || "Weather",
        severity: (a.severity as AlertSeverity) || "Moderate",
        title: `${a.severity} ${a.alert_type} Warning`,
        message: a.message,
        action: "Follow official instructions.",
        timestamp: a.created_at ? new Date(a.created_at).toLocaleString() : "Just now",
        sentBy: "authority",
        fresh: false
      }));
      setAlerts(formatted);
      setSentCount(formatted.length);
    }).catch(e => console.error(e));
  };

  useEffect(() => {
    refreshAlerts();
    const interval = setInterval(refreshAlerts, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const sendAlert = async (input: AlertInput) => {
    const record: AlertRecord = {
      location_name: input.area,
      alert_type: input.type,
      severity: input.severity,
      message: input.message,
      authority: "District Authority",
    };
    await postAlert(record);
    const alert: PravaahAlert = {
      ...input,
      id: `alert-${Date.now()}`,
      timestamp: "Just now",
      sentBy: "authority",
      fresh: true,
    };
    setAlerts((current) => [alert, ...current]);
    setUnread((current) => current + 1);
    setSentCount((current) => current + 1);
    
    window.setTimeout(() => {
      setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, fresh: false } : item)));
    }, 2200);
    return alert;
  };

  const value = useMemo(
    () => ({ alerts, unread, sentCount, latestAlert: alerts.length > 0 ? alerts[0] : null, sendAlert, markAllRead: () => setUnread(0), refreshAlerts }),
    [alerts, unread, sentCount],
  );
  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts() {
  const value = useContext(AlertContext);
  if (!value) throw new Error("useAlerts must be used inside AlertProvider");
  return value;
}
