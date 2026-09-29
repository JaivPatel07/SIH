import { createContext, useContext, useMemo, useState } from "react";

export type AlertType = "Flood" | "Landslide" | "Weather" | "Evacuation";
export type AlertSeverity = "Moderate" | "High" | "Critical";

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

const seededAlerts: PravaahAlert[] = [
  {
    id: "seed-1",
    area: "Dharali",
    type: "Flood",
    severity: "High",
    title: "Flash-flood risk increasing near Dharali",
    message: "Rainfall is increasing along the Bhagirathi corridor. Avoid riverbanks and low-lying crossings until conditions ease.",
    action: "Move away from river edges and follow marked safe routes.",
    timestamp: "12 min ago",
    sentBy: "authority",
  },
  {
    id: "seed-2",
    area: "Sukhi Gaon",
    type: "Evacuation",
    severity: "Critical",
    title: "Precautionary evacuation advised in Ward 3",
    message: "Residents should proceed to the nearest verified shelter using the marked safe route and keep contact devices charged.",
    action: "Carry essential medicines and assist children and older residents.",
    timestamp: "28 min ago",
    sentBy: "authority",
  },
  {
    id: "seed-3",
    area: "Bhagirathi Valley",
    type: "Weather",
    severity: "Moderate",
    title: "Heavy shower window expected through the evening",
    message: "Peak local rainfall is forecast for the next few hours. Keep emergency supplies and phones charged and avoid unnecessary travel.",
    action: "Avoid unnecessary travel during the peak rainfall window.",
    timestamp: "1 hr ago",
    sentBy: "authority",
  },
];

type AlertInput = Omit<PravaahAlert, "id" | "timestamp" | "sentBy" | "fresh">;

type AlertContextValue = {
  alerts: PravaahAlert[];
  unread: number;
  sentCount: number;
  latestAlert: PravaahAlert;
  sendAlert: (alert: AlertInput) => PravaahAlert;
  markAllRead: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState(seededAlerts);
  const [unread, setUnread] = useState(seededAlerts.length);
  const [sentCount, setSentCount] = useState(seededAlerts.length);

  const sendAlert = (input: AlertInput) => {
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
    () => ({ alerts, unread, sentCount, latestAlert: alerts[0], sendAlert, markAllRead: () => setUnread(0) }),
    [alerts, unread, sentCount],
  );
  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts() {
  const value = useContext(AlertContext);
  if (!value) throw new Error("useAlerts must be used inside AlertProvider");
  return value;
}
