import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  sentBy: "authority" | "system";
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
    title: "Example: flood-risk advisory",
    message: "Example advisory content for demonstrating how flood guidance is displayed.",
    action: "In an emergency, follow local authority instructions.",
    timestamp: "Example",
    sentBy: "system",
  },
  {
    id: "sample-evacuation",
    area: "Sukhi Gaon",
    type: "Evacuation",
    severity: "Critical",
    title: "Example: evacuation advisory",
    message: "Example advisory content for demonstrating evacuation guidance.",
    action: "Use only routes confirmed by local authorities.",
    timestamp: "Example",
    sentBy: "system",
  },
  {
    id: "sample-weather",
    area: "Uttarkashi",
    type: "Weather",
    severity: "Moderate",
    title: "Example: weather advisory",
    message: "Example advisory content for demonstrating a weather notification.",
    action: "Check official weather and disaster-management channels.",
    timestamp: "Example",
    sentBy: "system",
  },
  {
    id: "sample-landslide",
    area: "Kedarpur",
    type: "Landslide",
    severity: "High",
    title: "Example: landslide advisory",
    message: "Example advisory content for demonstrating landslide guidance.",
    action: "Avoid unstable slopes and follow official instructions.",
    timestamp: "Example",
    sentBy: "system",
  },
];

type AlertContextValue = {
  alerts: PravaahAlert[];
  usingSample: boolean;
  unread: number;
  sentCount: number;
  latestAlert: PravaahAlert | null;
  sendAlert: (alert: AlertInput) => Promise<PravaahAlert>;
  publishDemoAlert: (alert: AlertInput) => void;
  publishAutomaticAlert: (key: string, alert: AlertInput) => Promise<void>;
  dismissAlert: (id: string) => void;
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
        // Demo alerts exist only in this browser, so preserve them while the
        // live feed refreshes in the background.
        setAlerts((current) => [
          ...current.filter((alert) => alert.id.startsWith("demo-")),
          ...formatted,
        ]);
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

  const sendAlert = useCallback(async (input: AlertInput) => {
    const record: AlertRecord = {
      location_name: input.area,
      alert_type: input.type,
      severity: input.severity,
      message: input.message,
      authority: "District Authority",
    };
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

    // Keep the warning visible immediately. The backend can be temporarily
    // offline while the browser is still able to evaluate the risk model.
    postAlert(record).catch(() => undefined);
    
    window.setTimeout(() => {
      setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, fresh: false } : item)));
    }, 2200);
    return alert;
  }, []);

  // Demo notifications intentionally remain in the current browser session.
  // They let users experience the alert flow without publishing a false alert
  // to the live backend feed.
  const publishDemoAlert = useCallback((input: AlertInput) => {
    const alert: PravaahAlert = {
      ...input,
      id: `demo-${Date.now()}`,
      timestamp: "Just now",
      sentBy: "system",
      fresh: true,
    };
    setAlerts((current) => [alert, ...current.filter((item) => !item.id.startsWith("sample-"))]);
    setUsingSample(false);
    setUnread((current) => current + 1);
    setSentCount((current) => current + 1);
    window.setTimeout(() => {
      setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, fresh: false } : item)));
    }, 2200);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }, []);

  const publishAutomaticAlert = useCallback(async (key: string, input: AlertInput) => {
    const storageKey = `pravaah-auto-alert:${key}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "sent");

    const alert: PravaahAlert = {
      ...input,
      id: `auto-${key}`,
      timestamp: "Just now",
      sentBy: "system",
      fresh: true,
    };
    setAlerts((current) => [alert, ...current.filter((item) => !item.id.startsWith("sample-"))]);
    setUsingSample(false);
    setUnread((current) => current + 1);
    setSentCount((current) => current + 1);

    postAlert({
      location_name: input.area,
      alert_type: input.type,
      severity: input.severity,
      message: input.message,
      authority: "PRAVAAH Risk Engine",
    }).catch(() => undefined);
    window.setTimeout(() => {
      setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, fresh: false } : item)));
    }, 2200);
  }, []);

  const value = useMemo(
    () => ({ alerts, usingSample, unread, sentCount, latestAlert: alerts.length > 0 ? alerts[0] : null, sendAlert, publishDemoAlert, publishAutomaticAlert, dismissAlert, markAllRead: () => setUnread(0), refreshAlerts }),
    [alerts, usingSample, unread, sentCount, sendAlert, publishDemoAlert, publishAutomaticAlert, dismissAlert],
  );
  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts() {
  const value = useContext(AlertContext);
  if (!value) throw new Error("useAlerts must be used inside AlertProvider");
  return value;
}
