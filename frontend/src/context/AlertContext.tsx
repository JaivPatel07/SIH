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

/**
 * Sample advisories shown when the live alert feed is empty or unreachable so
 * the interface never renders a blank page. Flagged as `usingSample` in the UI.
 */
const SAMPLE_ALERTS: PravaahAlert[] = [
  {
    id: "sample-flood",
    area: "Dharali",
    type: "Flood",
    severity: "High",
    title: "Flash-flood risk increasing near Dharali",
    message: "Bhagirathi tributary levels are rising. Avoid riverbanks and low-lying crossings until 20:00.",
    action: "Avoid riverbanks, culverts and low-lying crossings until 20:00.",
    timestamp: "12 min ago",
    sentBy: "authority",
  },
  {
    id: "sample-evacuation",
    area: "Sukhi Gaon",
    type: "Evacuation",
    severity: "Critical",
    title: "Precautionary evacuation: Ward 3, Sukhi Gaon",
    message: "Residents should proceed to Sukhi Community Hall using the marked east road.",
    action: "Move calmly to Sukhi Community Hall via the marked east road.",
    timestamp: "28 min ago",
    sentBy: "authority",
  },
  {
    id: "sample-weather",
    area: "Uttarkashi",
    type: "Weather",
    severity: "Moderate",
    title: "Heavy rainfall expected 16:00–19:00",
    message: "Peak intensity of 56 mm/hr is forecast. Keep emergency supplies and phones charged.",
    action: "Keep supplies ready and avoid unnecessary travel.",
    timestamp: "1 hr ago",
    sentBy: "authority",
  },
  {
    id: "sample-landslide",
    area: "Kedarpur",
    type: "Landslide",
    severity: "High",
    title: "Slope movement detected above Kedarpur road",
    message: "Sensor KDP-04 reports unusual ground displacement. NH-34 traffic is being monitored.",
    action: "Avoid the marked road section and unstable slopes.",
    timestamp: "2 hrs ago",
    sentBy: "authority",
  },
];

type AlertContextValue = {
  alerts: PravaahAlert[];
  usingSample: boolean;
  unread: number;
  sentCount: number;
  latestAlert: PravaahAlert | null;
  sendAlert: (alert: AlertInput) => Promise<PravaahAlert>;
  markAllRead: () => void;
  refreshAlerts: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<PravaahAlert[]>(SAMPLE_ALERTS);
  const [usingSample, setUsingSample] = useState(true);
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
      if (formatted.length > 0) {
        setAlerts(formatted);
        setSentCount(formatted.length);
        setUsingSample(false);
      }
    }).catch(() => {
      // Keep the sample advisories in place when the live feed is unreachable.
      setUsingSample(true);
    });
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
    setAlerts((current) => [alert, ...current.filter((item) => !item.id.startsWith("sample-"))]);
    setUsingSample(false);
    setUnread((current) => current + 1);
    setSentCount((current) => current + 1);
    
    window.setTimeout(() => {
      setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, fresh: false } : item)));
    }, 2200);
    return alert;
  };

  const value = useMemo(
    () => ({ alerts, usingSample, unread, sentCount, latestAlert: alerts.length > 0 ? alerts[0] : null, sendAlert, markAllRead: () => setUnread(0), refreshAlerts }),
    [alerts, usingSample, unread, sentCount],
  );
  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts() {
  const value = useContext(AlertContext);
  if (!value) throw new Error("useAlerts must be used inside AlertProvider");
  return value;
}
