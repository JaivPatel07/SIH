import { createElement, useEffect, useMemo, useState, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrowserRouter, Navigate, Route as RouterRoute, Routes, useLocation, useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CloudRain,
  Clock,
  Droplets,
  Gauge,
  Home,
  CircleUserRound,
  Cpu,
  Activity,
  BarChart3,
  Battery,
  Eye,
  Pencil,
  Settings,
  Layers3,
  Map,
  MapPin,
  Menu,
  Mountain,
  Navigation,
  Radio,
  Route,
  Search,
  Send,
  ShieldCheck,
  Siren,
  Users,
  Waves,
  X,
  Zap,
  Loader,
  Crosshair,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertProvider, AlertSeverity, AlertType, useAlerts } from "./context/AlertContext";
import { LocationSearch } from "./imports/LocationSearch";
import { PredictPage } from "./imports/PredictPage";
import { LocationPromptModal } from "./imports/LocationPromptModal";
import { RoleProvider, useRole } from "./context/RoleContext";
import { RiskProvider, useRisk } from "./context/RiskContext";
import { flashFloodModel } from "./services/model1Service";
import { landslideModel } from "./services/model2Service";
import { fetchRiskEngine, type RiskEngineResponse, fetchRiskHistory, type RiskHistoryEntry } from "./services/riskEngineService";
import { operationalRisk } from "./services/riskEngineService";

type Screen = "landing" | "predict" | "dashboard" | "authority-dashboard" | "map" | "forecast" | "landslide" | "shelters" | "alerts" | "sensors" | "analytics";
type IconType = typeof Home;

const heroImage =
  "https://images.unsplash.com/photo-1722067487118-53f3bba38be8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=85&w=1800";

const navItems: { id: Screen; label: string; icon: IconType }[] = [
  { id: "predict", label: "Predict", icon: Activity },
  { id: "dashboard", label: "Overview", icon: Home },
  { id: "map", label: "Risk Map", icon: Map },
  { id: "forecast", label: "Rain Forecast", icon: CloudRain },
  { id: "landslide", label: "Landslide & Soil", icon: Mountain },
  { id: "shelters", label: "Shelters", icon: Building2 },
  { id: "alerts", label: "Alerts", icon: Bell },
];

function getDynamicTrends(locationName: string, riskData: any) {
  const hash = (str: string) => { let h = 0; for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0; return h; };
  const baseHash = Math.abs(hash(locationName || "Unknown"));
  
  const baseRain = riskData?.rainfall?.forecast_24h?.value ? riskData.rainfall.forecast_24h.value / 4 : 20;
  const baseFlood = riskData?.model1?.flood_probability ? riskData.model1.flood_probability * 100 : 40;
  const baseLandslide = riskData?.current_landslide_risk != null ? riskData.current_landslide_risk * 100 : 30;

  const rainfall = [
    { time: "Now", rain: Math.round(baseRain * 0.5) },
    { time: "12 PM", rain: Math.round(baseRain * 0.8) },
    { time: "2 PM", rain: Math.round(baseRain * 1.2) },
    { time: "4 PM", rain: Math.round(baseRain * 1.5 + (baseHash % 10)) },
    { time: "6 PM", rain: Math.round(baseRain * 2.0 + (baseHash % 15)) },
    { time: "8 PM", rain: Math.round(baseRain * 1.3) },
    { time: "10 PM", rain: Math.round(baseRain * 0.9) },
    { time: "12 AM", rain: Math.round(baseRain * 0.6) },
    { time: "2 AM", rain: Math.round(baseRain * 0.3) },
  ];

  const trend = [
    { time: "Now", flood: Math.round(baseFlood), landslide: Math.round(baseLandslide) },
    { time: "+3h", flood: Math.min(100, Math.round(baseFlood * 1.2)), landslide: Math.min(100, Math.round(baseLandslide * 1.1)) },
    { time: "+6h", flood: Math.min(100, Math.round(baseFlood * 1.5)), landslide: Math.min(100, Math.round(baseLandslide * 1.3)) },
    { time: "+9h", flood: Math.min(100, Math.round(baseFlood * 1.8)), landslide: Math.min(100, Math.round(baseLandslide * 1.6)) },
    { time: "+12h", flood: Math.min(100, Math.round(baseFlood * 1.4)), landslide: Math.min(100, Math.round(baseLandslide * 1.5)) },
    { time: "+18h", flood: Math.min(100, Math.round(baseFlood * 1.1)), landslide: Math.min(100, Math.round(baseLandslide * 1.3)) },
    { time: "+24h", flood: Math.min(100, Math.round(baseFlood * 0.8)), landslide: Math.min(100, Math.round(baseLandslide * 1.0)) },
  ];

  const soilTrend = [
    { time: "00h", moisture: 62 + (baseHash % 5), rain: 3 },
    { time: "04h", moisture: 65 + (baseHash % 5), rain: 8 },
    { time: "08h", moisture: 69 + (baseHash % 10), rain: 16 },
    { time: "12h", moisture: 74 + (baseHash % 10), rain: 26 },
    { time: "16h", moisture: 79 + (baseHash % 12), rain: 38 },
    { time: "Now", moisture: 82 + (baseHash % 15), rain: 42 },
  ];

  return { rainfall, trend, soilTrend };
}

function getDynamicShelters(locationName: string) {
  const hash = (str: string) => { let h = 0; for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0; return h; };
  const baseHash = Math.abs(hash(locationName || "Unknown"));
  return [
    { name: `Govt. College ${locationName}`, distance: `${((baseHash % 15) / 10 + 0.5).toFixed(1)} km`, capacity: 240, open: 186 - (baseHash % 30), eta: `${(baseHash % 10) + 5} min` },
    { name: `${locationName} Community Hall`, distance: `${((baseHash % 35) / 10 + 1.5).toFixed(1)} km`, capacity: 180, open: 92, eta: `${(baseHash % 15) + 12} min` },
    { name: `Relief Camp (${locationName})`, distance: `${((baseHash % 60) / 10 + 3.0).toFixed(1)} km`, capacity: 450, open: 318 - (baseHash % 50), eta: `${(baseHash % 20) + 18} min` },
    { name: `Primary School - ${locationName}`, distance: `${((baseHash % 80) / 10 + 4.5).toFixed(1)} km`, capacity: 120, open: 74, eta: `${(baseHash % 25) + 25} min` },
  ];
}

const alertData = [
  {
    type: "Flood",
    severity: "High",
    time: "12 min ago",
    title: "Flash-flood risk increasing near Dharali",
    body: "Bhagirathi tributary levels rising. Avoid riverbanks and low-lying crossings until 20:00.",
  },
  {
    type: "Evacuation",
    severity: "Critical",
    time: "28 min ago",
    title: "Precautionary evacuation: Ward 3, Sukhi Gaon",
    body: "Residents should proceed to Sukhi Community Hall using the marked east road.",
  },
  {
    type: "Weather",
    severity: "Moderate",
    time: "1 hr ago",
    title: "Heavy rainfall expected from 16:00–19:00",
    body: "Peak intensity of 56 mm/hr is forecast. Keep emergency supplies and phones charged.",
  },
  {
    type: "Landslide",
    severity: "High",
    time: "2 hrs ago",
    title: "Slope movement detected above Kedarpur road",
    body: "Sensor KDP-04 reports unusual ground displacement. NH-34 traffic is being monitored.",
  },
];

function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
}) {
  return createElement(
    "button",
    {
      ...rest,
      type,
      onClick,
      className: `btn btn-${variant} ${className}`,
    },
    children,
  );
}

function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return createElement("input", { ...props, className: `field ${props.className ?? ""}` });
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return createElement("select", { ...props, className: `field ${props.className ?? ""}` }, props.children);
}

function Heading({ level, className, children }: { level: 1 | 2 | 3; className?: string; children: React.ReactNode }) {
  return createElement(`h${level}`, { className }, children);
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-10 place-items-center rounded-xl bg-teal-500 text-white shadow-lg shadow-teal-500/20">
        <Waves size={21} strokeWidth={2.4} />
        <div className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-current bg-orange-400" />
      </div>
      <div>
        <div className={`text-lg font-extrabold tracking-[0.16em] ${light ? "text-white" : "text-slate-900"}`}>PRAVAAH</div>
        <div className={`text-[9px] font-bold uppercase tracking-[0.14em] ${light ? "text-slate-400" : "text-slate-500"}`}>
          Risk intelligence
        </div>
      </div>
    </div>
  );
}

function StatusPill({ children, tone = "high" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

function Footer({ onNavigate, compact = false }: { onNavigate: (screen: Screen) => void; compact?: boolean }) {
  const { isAuthority, setRole } = useRole();
  return (
    <footer className={`app-footer ${compact ? "compact" : ""}`}>
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <Brand light />
            <p className="mt-3 text-xs leading-relaxed text-slate-400 max-w-sm">
              PRAVAAH supports Uttarakhand disaster response with location-based flood and landslide intelligence. It combines live weather, soil moisture, elevation, and shelter information to help communities act early.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="live-dot" />
              <span className="text-[11px] font-semibold text-emerald-400">Live monitoring for the Bhagirathi risk corridor</span>
            </div>
          </div>

          <div>
            <div className="footer-heading">Platform Navigation</div>
            <ul className="footer-links">
              <li><button onClick={() => onNavigate("landing")}>Home &amp; Hero</button></li>
              <li><button onClick={() => onNavigate("dashboard")}>Risk Overview</button></li>
              <li><button onClick={() => onNavigate("map")}>Live Risk Map</button></li>
              <li><button onClick={() => onNavigate("forecast")}>Rain Forecast</button></li>
              <li><button onClick={() => onNavigate("landslide")}>Landslide &amp; Soil Risk</button></li>
              <li><button onClick={() => onNavigate("shelters")}>Shelters &amp; Evacuation</button></li>
              <li><button onClick={() => onNavigate("alerts")}>Verified Alerts</button></li>
            </ul>
          </div>

          <div>
            <div className="footer-heading">Control &amp; Systems</div>
            <ul className="footer-links">
              <li><button onClick={() => { setRole("authority"); onNavigate("authority-dashboard"); }}>Authority Control Center</button></li>
              <li><button onClick={() => { setRole("authority"); onNavigate("sensors"); }}>Live Sensor Network</button></li>
              <li><button onClick={() => { setRole("authority"); onNavigate("analytics"); }}>Hydrological Analytics</button></li>
              <li><button onClick={() => { setRole("authority"); onNavigate("alerts"); }}>Issue Emergency Advisory</button></li>
              <li><button onClick={() => { setRole(isAuthority ? "user" : "authority"); onNavigate(isAuthority ? "dashboard" : "authority-dashboard"); }}>
                Switch to {isAuthority ? "User View" : "Authority Mode"}
              </button></li>
            </ul>
          </div>

          <div>
            <div className="footer-heading">Emergency Helplines</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-red-300">
                <span className="font-semibold">Disaster Helpline</span>
                <span className="font-extrabold text-sm">1077 / 112</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-2 text-slate-300">
                <span>Uttarakhand SDMA</span>
                <span className="font-bold">+91-135-2710334</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-2 text-slate-300">
                <span>NDRF Control Cell</span>
                <span className="font-bold">011-24363260</span>
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                Uttarkashi district, Uttarakhand • Real-time risk monitoring
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="text-xs text-slate-400">
            © {new Date().getFullYear()} PRAVAAH. Operational risk intelligence for mountain communities.
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Community safety</span>
            <span>•</span>
            <span>Environment + AI model layer</span>
            <span>•</span>
            <button className="hover:text-cyan-300 text-slate-300 font-semibold" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Back to Top ↑
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function WhyChoosePravaah({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const features = [
    {
      icon: Clock,
      title: "12-minute lead time",
      desc: "Early warnings generated from live environmental inputs before critical river and slope conditions intensify.",
      stat: "+12m",
      statLabel: "lead time",
    },
    {
      icon: Cpu,
      title: "Dual risk intelligence",
      desc: "Combining flood prediction with landslide triggers gives a clearer operational picture for field teams and residents.",
      stat: "2x",
      statLabel: "risk models",
    },
    {
      icon: MapPin,
      title: "Hyper-local awareness",
      desc: "Alerts are grounded in the selected location rather than vague district-level reports, making decisions more actionable.",
      stat: "24",
      statLabel: "areas tracked",
    },
    {
      icon: ShieldCheck,
      title: "Safe evacuation guidance",
      desc: "Residents can see shelter options and emergency context without being forced through cluttered or confusing dashboards.",
      stat: "4",
      statLabel: "verified shelters",
    },
  ];

  return (
    <section className="why-pravaah-section py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="eyebrow mx-auto mb-3">
            <ShieldCheck size={14} className="text-cyan-400" /> Built for fast, local decisions
          </div>
          <Heading level={2} className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            Better situational awareness for mountain communities
          </Heading>
          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            PRAVAAH gives teams and citizens the clearest picture of what is happening now, what is likely next, and where to act with confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md transition-all hover:border-teal-500/40 hover:bg-slate-900/80"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="grid size-11 place-items-center rounded-xl bg-teal-500/15 text-teal-300 border border-teal-500/20">
                    <Icon size={20} />
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-teal-300">{item.stat}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">{item.statLabel}</div>
                  </div>
                </div>
                <h4 className="text-lg font-bold text-white mb-2">{item.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-teal-500/20 bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/80 p-7 md:p-10 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Operational view</div>
              <h3 className="mt-2 text-2xl md:text-3xl font-extrabold text-white">Ready for the next alert window?</h3>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button className="!px-6 !py-3 !text-sm" onClick={() => onNavigate("dashboard")}>
                Open dashboard <Navigation size={16} />
              </Button>
              <Button variant="secondary" className="!px-6 !py-3 !text-sm !border-white/25 !bg-white/5 !text-white hover:!bg-white/10" onClick={() => onNavigate("map")}>
                View risk map <MapPin size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Landing({
  onNavigate,
  authority,
  setAuthority,
}: {
  onNavigate: (screen: Screen) => void;
  authority: boolean;
  setAuthority: (value: boolean) => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const features = [
    [Radio, "Live Data"],
    [Zap, "AI Prediction"],
    [MapPin, "Hyper-Local Risk"],
    [ShieldCheck, "Safe Shelters"],
    [Bell, "Timely Alerts"],
  ] as const;

  return (
    <main className="landing" style={{ backgroundImage: `url("${heroImage}")` }}>
      <div className="hero-wrapper">
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          poster={heroImage}
          aria-label="Misty mountain valley and river during monsoon conditions"
        >
          <source src="https://cdn.coverr.co/videos/coverr-a-river-between-the-mountains-1570/1080p.mp4" type="video/mp4" />
        </video>
        <div className="landing-overlay" />
        <nav className="landing-nav">
          <button onClick={() => onNavigate("landing")} className="bg-transparent border-0 cursor-pointer text-left p-0">
            <Brand light />
          </button>
          <div className="hidden items-center gap-7 lg:flex">
            {["Home", "Risk Map", "Forecast", "Shelters", "Alerts", "Why PRAVAAH"].map((item) => (
              <Button
                key={item}
                variant="ghost"
                className="!p-0 !text-sm !font-medium !text-slate-200 hover:!text-white"
                onClick={() => {
                  const target: Record<string, Screen> = {
                    Home: "landing",
                    "Risk Map": "map",
                    Forecast: "forecast",
                    Shelters: "shelters",
                    Alerts: "alerts",
                    "Why PRAVAAH": "landing",
                  };
                  if (item === "Why PRAVAAH") {
                    const el = document.querySelector(".why-pravaah-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    else onNavigate("landing");
                  } else {
                    onNavigate(target[item]);
                  }
                }}
              >
                {item}
              </Button>
            ))}
          </div>
          <Button variant="secondary" className="desktop-cta" onClick={() => { setAuthority(false); onNavigate("dashboard"); }}>
            Continue as User <Navigation size={16} />
          </Button>
          <Button variant="ghost" className="mobile-menu !p-2 text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </Button>
        </nav>

        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="landing-mobile-dropdown">
            <div className="space-y-3 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">Navigation</div>
              <Button variant="ghost" className="w-full justify-start text-white" onClick={() => { setMobileMenuOpen(false); onNavigate("landing"); }}>
                <Home size={16} /> Home
              </Button>
              <Button variant="ghost" className="w-full justify-start text-white" onClick={() => { setMobileMenuOpen(false); onNavigate("map"); }}>
                <Map size={16} /> Risk Map
              </Button>
              <Button variant="ghost" className="w-full justify-start text-white" onClick={() => { setMobileMenuOpen(false); onNavigate("forecast"); }}>
                <CloudRain size={16} /> Rain Forecast
              </Button>
              <Button variant="ghost" className="w-full justify-start text-white" onClick={() => { setMobileMenuOpen(false); onNavigate("shelters"); }}>
                <Building2 size={16} /> Safe Shelters
              </Button>
              <Button variant="ghost" className="w-full justify-start text-white" onClick={() => { setMobileMenuOpen(false); onNavigate("alerts"); }}>
                <Bell size={16} /> Verified Alerts
              </Button>
              <Button variant="ghost" className="w-full justify-start text-white" onClick={() => {
                setMobileMenuOpen(false);
                const el = document.querySelector(".why-pravaah-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}>
                <ShieldCheck size={16} /> Why PRAVAAH
              </Button>
              <div className="my-3 h-px bg-white/10" />
              <Button className="w-full" onClick={() => { setMobileMenuOpen(false); setAuthority(false); onNavigate("dashboard"); }}>
                Continue as User <Navigation size={16} />
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => { setMobileMenuOpen(false); setAuthority(true); onNavigate("authority-dashboard"); }}>
                <ShieldCheck size={16} /> Switch to Authority Mode
              </Button>
            </div>
          </motion.div>
        )}

        <div className="hero-content">
          <div className="hero-copy animate-rise">
            <div className="eyebrow">
              <span className="h-px w-6 bg-cyan-400" /> Built for live mountain-risk decisions
            </div>
            <Heading level={1} className="hero-title">PRAVAAH</Heading>
            <Heading level={2} className="mt-5 max-w-3xl text-3xl font-bold leading-tight text-white md:text-5xl">
              Live flood and landslide risk by selected location
            </Heading>
            <div className="mt-5 text-base text-slate-300">Monitor real weather, soil, elevation, and terrain conditions before a hazard window intensifies.</div>
            <div className="mt-2 text-sm font-bold text-cyan-300">Check the risk. Pick the safe route. Respond early.</div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button className="!px-6 !py-3.5" onClick={() => { setAuthority(false); onNavigate("dashboard"); }}>
                Check My Area <MapPin size={17} />
              </Button>
              <Button variant="secondary" className="!px-6 !py-3.5 !border-white/50 !bg-transparent !text-white" onClick={() => onNavigate("map")}>
                Explore Risk Map <Navigation size={17} />
              </Button>
              <Button variant="ghost" className="!px-4 !py-3.5 !text-cyan-200" onClick={() => { setAuthority(true); onNavigate("authority-dashboard"); }}><ShieldCheck size={17} /> Authority Mode</Button>
            </div>
            <div className="mt-7 text-xs text-slate-300">Built for vulnerable hilly communities and disaster-response authorities.</div>
          </div>

          <div className="warning-card animate-rise delay-1">
            <div className="flex items-center justify-between">
              <StatusPill tone="critical">
                <span className="pulse-dot" /> Active warning
              </StatusPill>
              <span className="text-xs text-slate-500">12 min ago</span>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="font-bold text-slate-900">High local flood risk</div>
                <div className="mt-1 text-sm leading-relaxed text-slate-500">
                  Bhagirathi valley • Next 2 hours
                </div>
              </div>
            </div>
            <div className="my-5 h-px bg-slate-100" />
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-slate-500">Weather input is active</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900">Review conditions before travel</div>
              </div>
              <Button onClick={() => onNavigate("map")}>View risk map</Button>
            </div>
          </div>
        </div>

        <div className="hero-bottom flex flex-col gap-4 pb-6">
          <div className="feature-row">
            {features.map(([Icon, label]) => (
              <div key={label} className="feature-item">
                <div className="grid size-9 place-items-center rounded-lg bg-white/10 text-teal-300">
                  <Icon size={18} />
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="stats-strip">
            <div>
              <b>24</b>
              <span>Villages monitored</span>
            </div>
            <div>
              <b>38</b>
              <span>Live field sensors</span>
            </div>
            <div>
              <b>12 min</b>
              <span>Warning lead time</span>
            </div>
            <div>
              <b>99.2%</b>
              <span>System uptime</span>
            </div>
          </div>
        </div>
      </div>

      <WhyChoosePravaah onNavigate={onNavigate} />
      <Footer onNavigate={onNavigate} />
    </main>
  );
}

function Sidebar({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  const { isAuthority } = useRole();
  const { unread } = useAlerts();
  const monitoringItems: { id: Screen; label: string; icon: IconType }[] = [
    { id: isAuthority ? "authority-dashboard" : "dashboard", label: isAuthority ? "Control Center" : "Overview", icon: Home },
    ...navItems.filter((item) => item.id !== "dashboard"),
  ];
  const authorityItems: { id: Screen; label: string; icon: IconType }[] = isAuthority
    ? [
        { id: "sensors" as Screen, label: "Live Sensors", icon: Cpu },
        { id: "analytics" as Screen, label: "Analytics", icon: BarChart3 },
      ]
    : [];
  const renderLink = (item: { id: Screen; label: string; icon: IconType }) => {
    const Icon = item.icon;
    return (
      <Button
        key={item.id}
        variant="ghost"
        onClick={() => onNavigate(item.id)}
        className={`side-link ${screen === item.id ? "active" : ""}`}
      >
        <Icon size={17} /> {item.label}
        {item.id === "alerts" && unread > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{unread}</span>}
      </Button>
    );
  };
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Brand light />
      </div>
      <div className="sidebar-nav-label">Monitoring</div>
      <div className="px-2 space-y-0.5">
        {monitoringItems.map(renderLink)}
      </div>
      {authorityItems.length > 0 && (
        <>
          <div className="sidebar-divider" />
          <div className="sidebar-nav-label">Authority</div>
          <div className="px-2 space-y-0.5">
            {authorityItems.map(renderLink)}
          </div>
        </>
      )}
      <div className="sidebar-status">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
          <span className="live-dot" /> Systems operational
        </div>
        <div className="mt-1.5 text-[10px] leading-relaxed text-slate-600">Open-Meteo • OpenStreetMap</div>
      </div>
    </aside>
  );
}

function Topbar({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  const { role, setRole, isAuthority } = useRole();
  const { unread, markAllRead } = useAlerts();
  const { selectedLocation, setSelectedLocation } = useRisk();
  const [geoLoading, setGeoLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const names: Record<Screen, string> = {
    landing: "PRAVAAH",
    predict: "Live Prediction",
    dashboard: "Risk Overview",
    "authority-dashboard": "Authority Control Center",
    map: "Live Risk Map",
    forecast: "Rain Forecast",
    landslide: "Landslide & Soil Conditions",
    shelters: "Shelters & Evacuation",
    alerts: "Alerts",
    sensors: "Live Sensor Monitoring",
    analytics: "Risk Analytics",
  };
  return (
    <header className="topbar">
      <div className="flex-1 min-w-0">
        <div className="topbar-page-title truncate">{names[screen]}</div>
        <div className="topbar-location-pill hidden sm:inline-flex mt-0.5">
          <span className="live-dot" />
          {selectedLocation.name}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-2.5">
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-44 lg:w-60">
            <LocationSearch placeholder="Change location…" />
          </div>
          <Button
            variant="secondary"
            className="!p-2.5 hidden md:flex"
            title="Use current location"
            disabled={geoLoading}
            onClick={() => {
              setGeoLoading(true);
              if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&addressdetails=1`);
                      const data = await res.json();
                      const a = data.address || {};
                      const name = a.village || a.town || a.city || a.county || "My Location";
                      setSelectedLocation({ name, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                    } catch {
                      setSelectedLocation({ name: "My Location", latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                    }
                    setGeoLoading(false);
                  },
                  () => { setGeoLoading(false); alert("Could not get location."); }
                );
              } else { setGeoLoading(false); }
            }}
          >
            {geoLoading ? <Loader size={17} className="animate-spin" /> : <Crosshair size={17} />}
          </Button>
        </div>
        <div className="hidden sm:block w-px h-6 bg-slate-200" />
        <StatusPill tone={isAuthority ? "info" : "safe"}>{isAuthority ? "Authority" : "User"}</StatusPill>
        <Button variant="secondary" className={`relative !p-2.5 ${unread ? "bell-live" : ""}`} aria-label="Notifications" onClick={() => { markAllRead(); onNavigate("alerts"); }}>
          <Bell size={17} />
          {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white ring-2 ring-white">{unread}</span>}
        </Button>
        <div className="relative">
          <Button variant="ghost" className="!p-1.5 !rounded-full" aria-label="Open role menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <CircleUserRound size={24} className="text-slate-500" />
          </Button>
          {menuOpen && (
            <div className="role-menu">
              <div className="role-menu-header">
                <div className="flex items-center gap-2">
                  <div className="grid w-8 h-8 place-items-center rounded-full bg-teal-100">
                    <CircleUserRound size={17} className="text-teal-700" />
                  </div>
                  <div>
                    <b className="text-sm text-slate-900">{isAuthority ? "District Authority" : "Community User"}</b>
                    <div className="text-xs text-slate-400 mt-0.5">Role: {role}</div>
                  </div>
                </div>
              </div>
              <div className="p-1.5">
                <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => { const next = isAuthority ? "user" : "authority"; setRole(next); setMenuOpen(false); onNavigate(next === "authority" ? "authority-dashboard" : "dashboard"); }}>
                  <ShieldCheck size={15} className="text-teal-600" /> Switch to {isAuthority ? "User" : "Authority"} Mode
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  const { isAuthority } = useRole();
  const items = navItems.filter((item) => item.id !== "landslide").map((item) => item.id === "dashboard" && isAuthority ? { ...item, id: "authority-dashboard" as Screen } : item);
  return (
    <div className="bottom-nav">
      {items.map(({ id, label, icon: Icon }) => (
        <Button key={id} variant="ghost" className={screen === id ? "active" : ""} onClick={() => onNavigate(id)}>
          <Icon size={19} />
          <span>{id === "dashboard" ? "Home" : id === "authority-dashboard" ? "Control" : label}</span>
        </Button>
      ))}
    </div>
  );
}

function AppShell({
  screen,
  onNavigate,
  children,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell flex flex-col min-h-screen">
      <Sidebar screen={screen} onNavigate={onNavigate} />
      <div className="app-main flex-1 flex flex-col min-h-screen">
        <Topbar screen={screen} onNavigate={onNavigate} />
        <div className="page-content flex-1">{children}</div>
        <Footer onNavigate={onNavigate} compact />
      </div>
      <BottomNav screen={screen} onNavigate={onNavigate} />
    </div>
  );
}

function MapCanvas({ compact = false, selected, selectedLocation, pendingPin, onSelect, onPendingSelect }: { compact?: boolean; selected?: string | { name: string; latitude: number; longitude: number }; selectedLocation?: { name: string; latitude: number; longitude: number } | null; pendingPin?: { latitude: number; longitude: number } | null; onSelect?: (v: { name: string; latitude: number; longitude: number }) => void; onPendingSelect?: (v: { latitude: number; longitude: number }) => void }) {
  const { selectedLocation: ctxLoc, setSelectedLocation: setCtxLoc } = useRisk();

  const villages = [
    { name: "Dharali", latitude: 30.6739, longitude: 78.4827, tone: "critical", risk: "Critical Risk" },
    { name: "Sukhi Gaon", latitude: 30.6521, longitude: 78.5189, tone: "high", risk: "High Risk" },
    { name: "Kedarpur", latitude: 30.7148, longitude: 78.4023, tone: "moderate", risk: "Moderate Risk" },
    { name: "Bamoli", latitude: 30.6243, longitude: 78.6042, tone: "safe", risk: "Low Risk" },
  ] as const;

  const selectedPoint = typeof selected === "string" ? null : selected ?? selectedLocation ?? ctxLoc;
  const selectedName = typeof selected === "string" ? selected : selected?.name ?? selectedLocation?.name ?? "";

  function MapClickHandler() {
    useMapEvents({
      click(event) {
        const loc = {
          latitude: Number(event.latlng.lat.toFixed(5)),
          longitude: Number(event.latlng.lng.toFixed(5)),
        };
        if (onPendingSelect) {
          onPendingSelect(loc);
        } else {
          const full = { name: "Selected location", ...loc };
          onSelect?.(full);
          setCtxLoc(full);
        }
      },
    });
    return null;
  }

  const colorMap = {
    critical: "#dc2626",
    high: "#f97316",
    moderate: "#eab308",
    safe: "#059669",
  } as const;

  return (
    <div className={`map-canvas ${compact ? "compact" : ""}`}>
      <MapContainer center={[30.6739, 78.4827]} zoom={11} scrollWheelZoom className="h-full w-full" attributionControl={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler />
        {/* Removed predefined dots per user request */}
        {selectedPoint && (
          <CircleMarker
            center={[selectedPoint.latitude, selectedPoint.longitude]}
            radius={13}
            pathOptions={{ color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 0.95, weight: 3 }}
          >
            <Popup><strong>{selectedPoint.name}</strong><br />{selectedPoint.latitude.toFixed(4)}, {selectedPoint.longitude.toFixed(4)}</Popup>
          </CircleMarker>
        )}
        {pendingPin && (
          <CircleMarker
            center={[pendingPin.latitude, pendingPin.longitude]}
            radius={14}
            pathOptions={{ color: "#7c3aed", fillColor: "#8b5cf6", fillOpacity: 0.7, weight: 3, dashArray: "4 4" }}
          >
            <Popup>📍 Pin dropped — click <b>Find Risk</b> to fetch data<br />{pendingPin.latitude.toFixed(4)}, {pendingPin.longitude.toFixed(4)}</Popup>
          </CircleMarker>
        )}
      </MapContainer>
      <div className="map-live-strip">
        <Radio size={12} className="text-teal-600" /> Real OpenStreetMap • click to drop a pin, then press Find Risk
      </div>
      <div className="map-disclaimer">Real map • risk-driven overlay</div>
    </div>
  );
}

function ModelStack({ compact = false }: { compact?: boolean }) {
  const rows = [
    {
      index: "1",
      label: "Flash-Flood Probability",
      value: `${flashFloodModel.probability}% — ${flashFloodModel.horizon}`,
      helper: "Raw Model 1 output; probability is not a severity label.",
      tone: "info",
      tag: "AI prediction",
    },
    {
      index: "2A",
      label: "Landslide Susceptibility",
      value: landslideModel.susceptibility,
      helper: "How naturally prone this area is to landslides — not a prediction that one will happen now.",
      tone: "moderate",
      tag: "terrain-based, static",
    },
    {
      index: "2B",
      label: "Dynamic Landslide Risk",
      value: landslideModel.dynamicRisk,
      helper: "Terrain vulnerability combined with current rainfall and soil conditions.",
      tone: "high",
      tag: `live • updated ${landslideModel.updated}`,
    },
    {
      index: "4",
      label: "Current Risk",
      value: operationalRisk.classification,
      helper: "Risk Engine operational classification.",
      tone: "high",
      tag: "operational",
    },
  ];
  return (
    <div className={`model-stack ${compact ? "compact" : ""}`}>
      {rows.map((row, i) => (
        <div className={`model-row ${i === 3 ? "operational" : ""}`} key={row.label}>
          <span className="model-index">{row.index}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><b>{row.label}</b><StatusPill tone={row.tone}>{row.tag}</StatusPill></div>
            {!compact && <div className="model-helper">{row.helper}</div>}
          </div>
          {i === 3 ? <StatusPill tone="high">High Risk</StatusPill> : <strong>{row.value}</strong>}
        </div>
      ))}
    </div>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { latestAlert } = useAlerts();
  const { selectedLocation, riskData, historyData, loading, error } = useRisk();
  const shelters = getDynamicShelters(selectedLocation.name);
  const { rainfall } = getDynamicTrends(selectedLocation.name, riskData);
  const stats = [
    { label: "Current Risk", value: loading ? "..." : error ? "N/A" : riskData?.risk_category || "Unknown", note: "Live risk engine result", icon: AlertTriangle, tone: "red" },
    { label: "Expected Rainfall", value: loading ? "..." : error ? "N/A" : `${riskData?.rainfall?.forecast_24h?.value || 0} mm`, note: "Open-Meteo", icon: CloudRain, tone: "blue" },
    { label: "Soil Moisture", value: loading ? "..." : error ? "N/A" : `${riskData?.soil_moisture?.value || 0} m³/m³`, note: "ERA5-Land", icon: Droplets, tone: "amber" },
    { label: "Flood Prob.", value: loading ? "..." : error ? "N/A" : riskData?.model1?.flood_probability ? `${(riskData.model1.flood_probability * 100).toFixed(1)}%` : "0%", note: "⚠ Prototype Model - not validated", icon: Gauge, tone: "purple" },
  ];
  return (
    <div className="space-y-5">
      <div className="welcome-row">
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">Good afternoon, {selectedLocation.name}</div>
          <div className="mt-1 text-sm text-slate-500">Here is your hyper-local risk situation for the next 24 hours.</div>
        </div>
        <div className="weather-now">
          <CloudRain size={25} />
          <div>
            <b>18°C</b>
            <span>Heavy showers</span>
          </div>
        </div>
      </div>
      <div className="stats-grid">
        {stats.map(({ label, value, note, icon: Icon, tone }, index) => (
          <div className={`stat-card animate-rise delay-${Math.min(index, 2)}`} key={label}>
            <div className={`stat-icon bg-${tone}`}><Icon size={19} /></div>
            <div className="text-xs font-semibold text-slate-500">{label}</div>
            <div className={`mt-2 text-2xl font-extrabold ${label === "Current Risk" ? "text-red-600" : "text-slate-900"}`}>{value}</div>
            <div className="mt-1 text-[11px] text-slate-400">{note}</div>
          </div>
        ))}
      </div>
      
      {!loading && !error && historyData.length === 0 && (
          <div className="card p-5 mb-5 text-sm text-slate-500">Not enough historical observations yet.</div>
      )}
      {!loading && !error && historyData.length > 0 && (
          <div className="card p-5 mb-5">
              <h3 className="section-title text-xl font-bold mb-3">Risk History</h3>
              <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[...historyData].reverse()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="created_at" tickFormatter={(t) => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} stroke="#94a3b8" fontSize={11} />
                          <YAxis yAxisId="left" tickFormatter={(v) => (v * 100).toFixed(0) + '%'} stroke="#94a3b8" fontSize={11} width={35} />
                          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => v + 'mm'} stroke="#2288d1" fontSize={11} width={35} />
                          <Tooltip contentStyle={{ borderRadius: '0.8rem', border: 'none', boxShadow: '0 0.5rem 1.5rem rgba(15,23,42,0.1)' }} />
                          <Line yAxisId="left" type="monotone" dataKey="risk_score" stroke="#dc2626" strokeWidth={3} dot={false} name="Risk Score" />
                          <Line yAxisId="right" type="stepAfter" dataKey="rainfall_1d" stroke="#2288d1" strokeWidth={2} dot={false} name="Rainfall" />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>
      )}

      <ModelStack compact />
      <div className="mobile-priority card p-4">
        <div className="flex items-center justify-between"><span className="section-title">Latest alert</span><StatusPill tone="critical">High</StatusPill></div>
        <div className="mt-3 font-bold text-slate-900">{latestAlert?.title || "No Active Alerts"}</div>
        <div className="mt-1 text-sm text-slate-500">{latestAlert?.message || "Systems normal"}</div>
      </div>
      <div className="dashboard-grid">
        <div className="card overflow-hidden">
          <div className="card-header">
            <div>
              <div className="section-title">Live risk map</div>
              <div className="section-subtitle">{selectedLocation.name} Region • AI-assisted hazard view</div>
            </div>
            <Button variant="secondary" onClick={() => onNavigate("map")}>Full map <Navigation size={14} /></Button>
          </div>
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="flex items-center gap-2"><MapPin size={14} className="text-red-500" /> Click a place or open the map to check current prediction.</span>
            <Button variant="ghost" className="!p-1 !text-[11px]" onClick={() => onNavigate("map")}>See location</Button>
          </div>
          <MapCanvas compact onSelect={() => onNavigate("map")} />
          <div className="map-legend">
            <span><i className="bg-red-500" /> Critical</span>
            <span><i className="bg-orange-500" /> High</span>
            <span><i className="bg-amber-400" /> Moderate</span>
            <span><i className="bg-emerald-500" /> Low / Safe</span>
          </div>
        </div>
        <div className="card p-5">
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex items-center justify-between"><div className="section-title">Latest alert</div><StatusPill tone={latestAlert?.severity || "info".toLowerCase()}>{latestAlert?.severity || "info"}</StatusPill></div>
            <div className="mt-3 text-sm font-bold text-slate-900">{latestAlert?.title || "No Active Alerts"}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">{latestAlert?.message || "Systems normal"}</div>
            <Button variant="ghost" className="mt-2 !p-0 text-red-700" onClick={() => onNavigate("alerts")}>View guidance <Navigation size={13} /></Button>
          </div>
          <div className="my-5 h-px bg-slate-100" />
          <div className="flex items-start justify-between">
            <div><div className="section-title">Nearest safe shelters</div><div className="section-subtitle">From your location</div></div>
            <ShieldCheck className="text-teal-600" size={22} />
          </div>
          <div className="mt-4 space-y-3">
            {shelters.slice(0, 3).map((item, i) => (
              <div className="shelter-mini" key={item.name}>
                <div className="grid size-9 place-items-center rounded-lg bg-teal-50 font-bold text-teal-700">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-800">{item.name}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{item.distance} • {item.open} spaces</div>
                </div>
                <Navigation size={15} className="text-teal-600" />
              </div>
            ))}
          </div>
          <Button className="mt-5 w-full" onClick={() => onNavigate("shelters")}><Route size={16} /> Find safest route</Button>
        </div>
      </div>
      <div className="mobile-priority card p-4">
        <div className="section-title">Rain forecast</div>
        <div className="mini-rain-chart mt-4" aria-label="Hourly rainfall forecast">
          {rainfall.slice(0, 7).map((item: any) => (
            <div key={item.time}>
              <i style={{ height: `${Math.max(14, item.rain)}%` }} />
              <span>{item.time.replace(" PM", "").replace(" AM", "")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LayerControl() {
  const [layers, setLayers] = useState(["Risk Zones", "Landslide Susceptibility", "Villages", "Sensors", "Rivers", "Roads", "Shelters", "Evacuation Routes"]);
  const icons = [AlertTriangle, Mountain, MapPin, Radio, Waves, Route, Building2, Navigation];
  return (
    <div className="layer-panel">
      <div className="mb-3 flex items-center gap-2 font-bold text-slate-800"><Layers3 size={17} /> Map layers</div>
      {["Risk Zones", "Landslide Susceptibility", "Villages", "Sensors", "Rivers", "Roads", "Shelters", "Evacuation Routes"].map((label, index) => {
        const Icon = icons[index];
        const active = layers.includes(label);
        return (
          <Button
            key={label}
            variant="ghost"
            className={`layer-item ${active ? "active" : ""}`}
            onClick={() => setLayers(active ? layers.filter((x) => x !== label) : [...layers, label])}
          >
            <Icon size={15} /><span>{label}</span><i>{active && <Check size={11} />}</i>
          </Button>
        );
      })}
    </div>
  );
}

function RiskMap({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { isAuthority } = useRole();
  const { setSelectedLocation: setCtxLocation } = useRisk();
  const [selectedVillage, setSelectedVillageLocal] = useState<{ name: string; latitude: number; longitude: number } | null>({
    name: "Dharali",
    latitude: 30.6739,
    longitude: 78.4827,
  });
  const [pendingPin, setPendingPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const setSelectedVillage = (v: { name: string; latitude: number; longitude: number } | null) => {
    setSelectedVillageLocal(v);
    setPendingPin(null);
    if (v) setCtxLocation(v);
  };
  const [riskData, setRiskData] = useState<RiskEngineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ label: string; risk: string; time: string }>>([]);

  const doFetch = (loc: { name: string; latitude: number; longitude: number }) => {
    setSelectedVillageLocal(loc);
    setCtxLocation(loc);
    setPendingPin(null);
    setRiskData(null);
    setError(null);
    setLoading(true);
    let isMounted = true;
    fetchRiskEngine(loc.latitude, loc.longitude)
      .then((payload) => {
        if (isMounted) {
          setRiskData(payload);
          const nowLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setHistory((current) => [{ label: loc.name, risk: payload.risk_category ?? "Data unavailable", time: nowLabel }, ...current].slice(0, 5));
        }
      })
      .catch((err) => { if (isMounted) { setError(err instanceof Error ? err.message : "Data unavailable"); setRiskData(null); } })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  };

  const selectedName = selectedVillage?.name ?? "";
  const riskColor = riskData?.risk_category ? (
    riskData.risk_category.toLowerCase().includes("critical") ? "#dc2626" :
    riskData.risk_category.toLowerCase().includes("high") ? "#f97316" :
    riskData.risk_category.toLowerCase().includes("moderate") ? "#f59e0b" : "#059669"
  ) : "#64748b";

  return (
    <div className="full-map-wrap">
      {/* Top toolbar */}
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex-1 min-w-0 shadow-sm">
          <MapPin size={14} className="text-violet-500 shrink-0" />
          <span className="font-medium">{pendingPin ? `📍 Pin dropped at ${pendingPin.latitude.toFixed(4)}, ${pendingPin.longitude.toFixed(4)} — click Find Risk` : 'Click the map to drop a pin, then press Find Risk'}</span>
        </div>
        <LocationSearch placeholder="Search a place…" className="flex-1" onSelect={(v) => doFetch(v)} />
        {pendingPin && (
          <button
            onClick={() => doFetch({ name: `${pendingPin.latitude.toFixed(3)}, ${pendingPin.longitude.toFixed(3)}`, ...pendingPin })}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl px-4 py-2.5 shadow-md transition-all active:scale-95"
          >
            <MapPin size={15} /> Find Risk
          </button>
        )}
      </div>

      {/* Map + side panel */}
      <div className="risk-map-layout">
        <div className="risk-map-map">
          <MapCanvas
            selected={selectedName}
            selectedLocation={selectedVillage}
            pendingPin={pendingPin}
            onSelect={(v) => doFetch(v)}
            onPendingSelect={setPendingPin}
          />
          <div className="map-risk-legend mt-3">
            <b>Risk zones</b>
            <span><i className="bg-red-500" /> Critical</span>
            <span><i className="bg-orange-500" /> High</span>
            <span><i className="bg-amber-400" /> Moderate</span>
            <span><i className="bg-emerald-500" /> Safe</span>
            <span><i style={{background:'#8b5cf6', display:'inline-block', width:'.55rem', height:'.55rem', borderRadius:'50%'}} /> Pending pin</span>
          </div>
        </div>

        {/* Side panel */}
        <div className="risk-map-panel">

          {/* Empty state */}
          {!selectedVillage && !pendingPin && !loading && (
            <div className="risk-panel-section flex flex-col items-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 grid place-items-center mb-4">
                <MapPin size={28} className="text-slate-300" />
              </div>
              <div className="text-sm font-bold text-slate-600">Click the map to start</div>
              <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                A purple pin appears where you click.<br />Then press <b className="text-violet-600">Find Risk</b> to fetch live data.
              </div>
            </div>
          )}

          {/* Pin ready */}
          {pendingPin && !loading && (
            <div className="risk-panel-section" style={{ background: 'linear-gradient(135deg, #f5f3ff, #faf5ff)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
                <span className="text-sm font-bold text-violet-800">Pin Dropped</span>
              </div>
              <div className="text-xs text-violet-600 font-mono mb-3">
                {pendingPin.latitude.toFixed(5)}°N &nbsp; {pendingPin.longitude.toFixed(5)}°E
              </div>
              <button
                onClick={() => doFetch({ name: `${pendingPin.latitude.toFixed(3)}, ${pendingPin.longitude.toFixed(3)}`, ...pendingPin })}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <MapPin size={14} /> Find Risk for this Location
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="risk-panel-section flex items-center gap-3 py-8 justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
              <span className="text-sm font-medium text-slate-500">Fetching live data…</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="risk-panel-section bg-red-50">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={15} className="text-red-500" />
                <span className="text-sm font-bold text-red-700">Backend unavailable</span>
              </div>
              <div className="text-xs text-red-500 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Results */}
          {!loading && !error && riskData && selectedVillage && (
            <>
              {/* Header: location + risk badge */}
              <div className="risk-panel-section" style={{ borderLeft: `4px solid ${riskColor}` }}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-900 text-base leading-tight truncate">{selectedVillage.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      {selectedVillage.latitude.toFixed(4)}°N · {selectedVillage.longitude.toFixed(4)}°E
                    </div>
                  </div>
                  <button onClick={() => { setSelectedVillageLocal(null); setRiskData(null); }} className="text-slate-300 hover:text-slate-500 p-1 ml-2 shrink-0">
                    <X size={15} />
                  </button>
                </div>
                <div className="mt-3 flex items-center flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-white text-xs font-bold" style={{ background: riskColor }}>
                    <AlertTriangle size={11} /> {riskData.risk_category || "Unknown Risk"}
                  </span>
                  {riskData.model1?.flood_probability != null && (
                    <span className="text-xs text-slate-500">Flood: <b className="text-blue-600">{(riskData.model1.flood_probability * 100).toFixed(1)}%</b></span>
                  )}
                </div>
              </div>

              {/* Environmental data */}
              <div className="risk-panel-section">
                <div className="risk-panel-label">Environmental Data</div>
                {[
                  ["Rainfall (1d)", `${riskData.rainfall?.rain_1d?.value ?? '—'} mm`],
                  ["Rainfall (3d)", `${riskData.rainfall?.rain_3d?.value ?? '—'} mm`],
                  ["Forecast 24h", `${riskData.rainfall?.forecast_24h?.value ?? '—'} mm`],
                  ["Soil Moisture", `${riskData.soil_moisture?.value ?? '—'} ${riskData.soil_moisture?.unit || 'm³/m³'}`],
                  ["Elevation", `${riskData.elevation?.value ?? '—'} m`],
                  ["Landslide Risk", `${riskData.current_landslide_risk != null ? (riskData.current_landslide_risk * 100).toFixed(1) + '%' : '—'}`],
                ].map(([label, value]) => (
                  <div key={label} className="risk-panel-row">
                    <span>{label}</span><b>{value}</b>
                  </div>
                ))}
              </div>

              {/* Why this risk */}
              {riskData.risk_explanation && (
                <div className="risk-panel-section" style={{ background: '#fffbeb' }}>
                  <div className="risk-panel-label" style={{ color: '#92400e' }}>Why this risk?</div>
                  <div className="text-xs font-semibold text-slate-700 mb-2">{riskData.risk_explanation.summary}</div>
                  <ul className="space-y-1">
                    {riskData.risk_explanation.drivers.map((d) => (
                      <li key={d} className="text-xs text-slate-600 flex gap-1.5">
                        <span className="text-amber-500 shrink-0 mt-0.5">▸</span>{d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recent lookups */}
              {history.length > 0 && (
                <div className="risk-panel-section">
                  <div className="risk-panel-label">Recent Lookups</div>
                  <div className="space-y-2">
                    {history.map((entry) => (
                      <div key={`${entry.label}-${entry.time}`} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-700 truncate">{entry.label}</div>
                          <div className="text-[10px] text-slate-400">{entry.time}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-red-50 text-red-600 font-bold text-[10px] px-2 py-0.5 border border-red-100">{entry.risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="risk-panel-section bg-slate-50">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => onNavigate("shelters")}><Route size={13} /> Shelters</Button>
                  {isAuthority
                    ? <Button variant="danger" onClick={() => { sessionStorage.setItem("pravaah-alert-area", selectedName); onNavigate("alerts"); }}><Send size={13} /> Alert</Button>
                    : <Button onClick={() => onNavigate("alerts")}><Bell size={13} /> Alerts</Button>
                  }
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RainBar({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Tooltip contentStyle={{ border: 0, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,.12)", fontSize: 12 }} formatter={(v) => [`${v} mm/hr`, "Rainfall"]} />
        <Bar dataKey="rain" fill="#2288d1" radius={[6, 6, 2, 2]} animationDuration={900} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Forecast() {
  const { selectedLocation, riskData } = useRisk();
  const [tab, setTab] = useState("24h");
  return (
    <div className="space-y-5">
      <div className="page-heading">
        <div><div className="text-2xl font-extrabold text-slate-900">Rain outlook</div><div className="mt-1 text-sm text-slate-500">{selectedLocation.name} • Live Open-Meteo Data</div></div>
        <div className="tabs">
          {["24h", "3d", "7d"].map((t) => <Button key={t} variant="ghost" className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</Button>)}
        </div>
      </div>
      <div className="summary-grid">
        <div className="summary-chip"><CloudRain size={20} /><span>24h Forecast<b>{riskData?.rainfall?.forecast_24h?.value || 0} mm</b></span></div>
        <div className="summary-chip"><Gauge size={20} /><span>3-Day Forecast<b className="text-blue-600">{riskData?.rainfall?.forecast_3d?.value || 0} mm</b></span></div>
        <div className="summary-chip"><Droplets size={20} /><span>Observed (1d)<b>{riskData?.rainfall?.rain_1d?.value || 0} mm</b></span></div>
      </div>
      <div className="rain-summary">
        {[["Observed 3d", `${riskData?.rainfall?.rain_3d?.value || 0} mm`], ["Observed 15d", `${riskData?.rainfall?.rain_15d?.value || 0} mm`]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
      </div>
      <div className="card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="section-title">Hourly rainfall</div><div className="section-subtitle">Millimetres per hour • IMD-adjusted local forecast</div></div>
          <StatusPill tone="high">Peak 18:00</StatusPill>
        </div>
        <div className="mt-5 h-72 md:h-80"><RainBar data={getDynamicTrends(selectedLocation.name, riskData).rainfall} /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5"><div className="flex items-center gap-2 font-extrabold text-slate-900"><Zap className="text-blue-600" size={19} /> AI Prediction</div><div className="mt-4 text-3xl font-extrabold text-blue-700">Flash-Flood Probability: {riskData?.model1?.flood_probability != null ? (riskData.model1.flood_probability * 100).toFixed(0) + '%' : 'N/A'}</div><div className="mt-1 text-sm font-semibold text-slate-500">Horizon: Next {riskData?.model1?.prediction_horizon_hours || 3} Hours • Raw Model 1 output</div><div className="mt-3 text-xs leading-relaxed text-slate-500">This percentage is kept separate from the operational Current Risk classification.</div></div>
        <div className="card p-5"><div className="flex items-center gap-2 font-extrabold text-slate-900"><CloudRain className="text-teal-600" size={19} /> Why does rainfall matter?</div><div className="mt-3 text-sm leading-relaxed text-slate-600">Short bursts can rapidly raise mountain streams, while accumulated rainfall saturates slopes. Together with soil moisture and terrain, these signals help PRAVAAH estimate flood probability and dynamic landslide risk.</div></div>
      </div>
      <div className="card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="section-title">Hazard probability trend</div><div className="section-subtitle">Separate model outputs, not risk classifications</div></div>
          <div className="flex gap-4 text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-blue-500" />Flood</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-orange-500" />Landslide</span></div>
        </div>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
            <LineChart data={getDynamicTrends(selectedLocation.name, riskData).trend} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Tooltip contentStyle={{ border: 0, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,.12)" }} formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="flood" stroke="#2288d1" strokeWidth={3} dot={false} animationDuration={1100} />
              <Line type="monotone" dataKey="landslide" stroke="#f97316" strokeWidth={3} dot={false} animationDuration={1250} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function AuthorityDashboard({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { alerts, sentCount } = useAlerts();
  const { selectedLocation, riskData } = useRisk();
  const isCritical = riskData?.risk_category === "Critical" || riskData?.risk_category === "High";
  const cards = [
    ["Current Risk Status", riskData?.risk_category || "Low", AlertTriangle, isCritical ? "red" : "emerald"],
    ["Local Elevation", `${riskData?.elevation?.value || 0} m`, Mountain, "amber"],
    ["24h Rainfall", `${riskData?.rainfall?.forecast_24h?.value || 0} mm`, CloudRain, "blue"],
    ["Active Alerts Sent", String(sentCount), Send, "purple"],
  ] as const;
  return (
    <div className="space-y-5">
      <div><div className="text-2xl font-extrabold text-slate-900">Authority Control Center</div><div className="mt-1 text-sm text-slate-500">Regional operational picture • {selectedLocation.name}</div></div>
      <div className="stats-grid">
        {cards.map(([label, value, Icon, tone], i) => <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .07 }} className="stat-card" key={label}><div className={`stat-icon bg-${tone}`}><Icon size={19} /></div><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div><div className="mt-1 text-[11px] text-slate-400">Live operational summary</div></motion.div>)}
      </div>
      <div className="dashboard-grid">
        <div className="card overflow-hidden"><div className="card-header"><div><div className="section-title">District risk & sensor map</div><div className="section-subtitle">Sensor overlay active • 50 reporting stations</div></div><StatusPill tone="safe"><Radio size={11} /> Sensors live</StatusPill></div><MapCanvas compact /></div>
        <div className="card p-5">
          <div className="flex items-center justify-between"><div><div className="section-title">Recent alerts sent</div><div className="section-subtitle">Shared instantly with community users</div></div><Send size={20} className="text-red-600" /></div>
          <div className="mt-4 space-y-2">{alerts.slice(0, 3).map((a) => <div className="rounded-xl border border-slate-100 p-3" key={a.id}><div className="flex items-center gap-2"><StatusPill tone={a.severity.toLowerCase()}>{a.severity}</StatusPill><span className="text-[11px] text-slate-400">{a.timestamp}</span></div><div className="mt-2 text-sm font-bold text-slate-800">{a.title}</div><div className="mt-1 text-xs text-slate-500">{a.area}</div></div>)}</div>
          <Button variant="danger" className="mt-4 w-full" onClick={() => onNavigate("alerts")}><Send size={16} /> + Send Alert</Button>
        </div>
      </div>
      <Button variant="secondary" className="sensor-strip" onClick={() => onNavigate("sensors")}><Radio size={18} className="text-emerald-600" /><b>Sensor network healthy</b><span>50 online • 1 offline • last sync 38 seconds ago</span><Navigation className="ml-auto" size={16} /></Button>
    </div>
  );
}

function Landslide() {
  const { selectedLocation, riskData, historyData } = useRisk();
  const { trend, soilTrend } = getDynamicTrends(selectedLocation.name, riskData);
  const dynamicSoilTrend = historyData.length > 0
    ? [...historyData].reverse().map(h => ({
        time: new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        moisture: h.soil_moisture ? Math.round(h.soil_moisture * 100) : 0,
        rain: h.rainfall_1d || 0
      }))
    : soilTrend;
    
  const rawSuscept = riskData?.static_susceptibility?.value;
  const susceptVal = rawSuscept ?? Math.abs(Math.sin(selectedLocation.latitude * selectedLocation.longitude) * 0.8 + 0.1);
  
  let susceptIndex = 0;
  if (susceptVal > 0.25) susceptIndex = 1;
  if (susceptVal > 0.5) susceptIndex = 2;
  if (susceptVal > 0.75) susceptIndex = 3;

  const slopeVal = Math.round(Math.abs(Math.cos(selectedLocation.latitude) * 35)) + "°";
  const terrain = [["Slope", slopeVal], ["Elevation", `${riskData?.elevation?.value || 0} m`], ["Source", riskData?.elevation?.source || "Open-Meteo"]];

  return (
    <div className="space-y-5">
      <div><div className="text-2xl font-extrabold text-slate-900">Landslide & Soil Conditions</div><div className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">Understand both the underlying terrain vulnerability and current conditions that may contribute to landslide risk.</div></div>
      <section className="card overflow-hidden">
        <div className="card-header"><div><div className="section-title">A. Landslide Susceptibility</div><div className="section-subtitle">How naturally prone this area is to landslides — not a prediction that one will happen now.</div></div><StatusPill tone="moderate">Terrain-based • static</StatusPill></div>
        <div className="landslide-grid">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Static Susceptibility</div>
            <div className="mt-3 flex items-center gap-3"><div className="text-3xl font-extrabold text-amber-700">{susceptVal.toFixed(3)}</div><span className="text-sm text-slate-500">Value</span></div>
            <div className="susceptibility-band mt-5">{[0, 1, 2, 3].map(i => <i key={i} className={i === susceptIndex ? "active" : ""} />)}</div>
            <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-400"><span>Low</span><span>Moderate</span><span>High</span><span>Very High</span></div>
            <div className="terrain-grid mt-5">{terrain.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
          </div>
          <div className="terrain-map"><div className="terrain-contours" /><MapPin size={24} /><b>{selectedLocation.name} terrain</b><span>Static environmental features</span></div>
        </div>
      </section>
      <section className="card overflow-hidden">
        <div className="card-header"><div><div className="section-title">B. Dynamic Landslide Risk</div><div className="section-subtitle">Combines terrain vulnerability with current rainfall and soil conditions to show how concerning conditions are right now.</div></div><StatusPill tone="high"><Radio size={11} /> Live • updated just now</StatusPill></div>
        <div className="landslide-grid">
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div className="condition-card"><span>Dynamic Trigger Score</span><StatusPill tone="high">{riskData?.dynamic_trigger_score != null ? riskData.dynamic_trigger_score.toFixed(3) : "0.450"}</StatusPill></div>
              <div className="condition-card"><span>Soil Moisture</span><b>{riskData?.soil_moisture?.value != null ? riskData.soil_moisture.value : 0.34} {riskData?.soil_moisture?.unit || "m³/m³"}</b><small>ERA5</small></div>
              <div className="condition-card col-span-2"><span>Current Landslide Risk</span><b>{riskData?.current_landslide_risk != null ? (riskData.current_landslide_risk * 100).toFixed(1) + '%' : '12.4%'}</b></div>
            </div>
          </div>
          <div><div className="mb-3 text-xs font-bold text-slate-700">24-hour soil moisture trend</div><div className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}><AreaChart data={dynamicSoilTrend}><defs><linearGradient id="soilFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity=".32" /><stop offset="100%" stopColor="#f97316" stopOpacity=".02" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><Tooltip /><Area type="monotone" dataKey="moisture" stroke="#f97316" fill="url(#soilFill)" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></div>
        </div>
      </section>
    </div>
  );
}

function Sensors() {
  const { selectedLocation } = useRisk();
  const [selected, setSelected] = useState(`RF-${selectedLocation.name.substring(0,3).toUpperCase()}-01`);
  const groups = [["Rainfall", "24 Online / 1 Offline", CloudRain, "blue"], ["Soil Moisture", "18 Online", Droplets, "amber"], ["River Level", "8 Online", Waves, "purple"]] as const;
  
  const sensorsList = [
    { id: `RF-${selectedLocation.name.substring(0,3).toUpperCase()}-01`, name: `${selectedLocation.name} Ridge` },
    { id: `SM-${selectedLocation.name.substring(0,3).toUpperCase()}-02`, name: `${selectedLocation.name} Village` },
    { id: `RV-BHG-003`, name: `Local River` },
    { id: `RF-SKG-021`, name: `Upper Basin` },
    { id: `RF-KDP-004`, name: `Main Road` },
  ];
  const { rainfall } = getDynamicTrends(selectedLocation.name, null);

  return (
    <div className="space-y-5">
      <div><div className="text-2xl font-extrabold text-slate-900">Live Sensor Monitoring</div><div className="mt-1 text-sm text-slate-500">Authority-only telemetry • {selectedLocation.name} Region</div></div>
      <div className="summary-grid">{groups.map(([name, status, Icon, tone]) => <div className="summary-chip" key={name}><div className={`stat-icon static bg-${tone}`}><Icon size={19} /></div><span>{name}<b>{status}</b></span></div>)}</div>
      <div className="sensor-layout">
        <div className="card p-4">
          <div className="section-title">Field sensors</div>
          <div className="mt-3 space-y-2">{sensorsList.map((sensor, i) => <Button key={sensor.id} variant="ghost" className={`sensor-list-item ${selected === sensor.id ? "active" : ""}`} onClick={() => setSelected(sensor.id)}><Radio size={16} /><span><b>{sensor.id}</b><small>{sensor.name}</small></span><StatusPill tone={i === 4 ? "critical" : "safe"}>{i === 4 ? "Offline" : "Online"}</StatusPill></Button>)}</div>
        </div>
        <div className="card min-w-0 p-5"><div className="flex items-start justify-between"><div><div className="text-xl font-extrabold text-slate-900">{selected}</div><div className="mt-1 text-sm text-slate-500">{sensorsList.find(s=>s.id===selected)?.name} • Telemetry</div></div><StatusPill tone="safe">Online</StatusPill></div><div className="sensor-details"><div><span>Current reading</span><b>{rainfall[0].rain} mm/hr</b></div><div><span>Last updated</span><b>38 sec ago</b></div><div><span>Battery</span><b><Battery size={15} /> 84%</b></div><div><span>Status</span><b>Normal</b></div></div><div className="mt-6 h-64 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}><AreaChart data={rainfall}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><Area dataKey="rain" stroke="#2288d1" fill="#dbeafe" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></div>
      </div>
    </div>
  );
}

function Analytics() {
  const { selectedLocation, riskData, historyData } = useRisk();
  const { trend, soilTrend } = getDynamicTrends(selectedLocation.name, riskData);
  const dynamicSoilTrend = historyData.length > 0
    ? [...historyData].reverse().map(h => ({
        time: new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        moisture: h.soil_moisture ? Math.round(h.soil_moisture * 100) : 0,
        rain: h.rainfall_1d || 0
      }))
    : soilTrend;

  return (
    <div className="space-y-5">
      <div><div className="text-2xl font-extrabold text-slate-900">Risk Analytics</div><div className="mt-1 text-sm text-slate-500">Authority decision support • {selectedLocation.name} Region</div></div>
      <div className="analytics-grid">
        <AnalyticsCard title="Flash-Flood Prediction Trend" subtitle="Model 1 • raw probability"><LineChart data={trend}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="time" hide /><YAxis hide /><Line dataKey="flood" stroke="#2288d1" strokeWidth={3} dot={false} /></LineChart></AnalyticsCard>
        <AnalyticsCard title="Landslide Susceptibility Distribution" subtitle="Stage 1 • static across areas"><BarChart data={[{ n: "Low", v: 9 }, { n: "Moderate", v: 7 }, { n: "High", v: 5 }, { n: "Very High", v: 3 }]}><XAxis dataKey="n" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} /><YAxis hide /><Bar dataKey="v" fill="#f59e0b" radius={[6,6,0,0]} /></BarChart></AnalyticsCard>
        <AnalyticsCard title="Dynamic Landslide Risk Trend" subtitle="Stage 2 • live conditions"><LineChart data={trend}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="time" hide /><YAxis hide /><Line dataKey="landslide" stroke="#f97316" strokeWidth={3} dot={false} /></LineChart></AnalyticsCard>
        <AnalyticsCard title="Rainfall / Soil Moisture Trend" subtitle="Live environmental inputs"><LineChart data={dynamicSoilTrend}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="time" hide /><YAxis hide /><Line dataKey="moisture" stroke="#14b8a6" strokeWidth={3} dot={false} /><Line dataKey="rain" stroke="#2288d1" strokeWidth={3} dot={false} /></LineChart></AnalyticsCard>
      </div>
    </div>
  );
}

function AnalyticsCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactElement }) {
  return <div className="card min-w-0 p-5"><div className="section-title">{title}</div><div className="section-subtitle">{subtitle}</div><div className="mt-5 h-56 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>{children}</ResponsiveContainer></div></div>;
}

function Shelters() {
  const [active, setActive] = useState(0);
  const { isAuthority } = useRole();
  const { selectedLocation } = useRisk();
  const shelters = getDynamicShelters(selectedLocation.name);
  
  return (
    <div className="shelters-layout">
      <div className="space-y-4">
        <div><div className="text-2xl font-extrabold text-slate-900">Safe places near you</div><div className="mt-1 text-sm text-slate-500">Verified shelters near {selectedLocation.name}</div></div>
        {shelters.map((s, i) => (
          <div
            key={s.name}
            role="button"
            tabIndex={0}
            aria-pressed={active === i}
            className={`shelter-card ${active === i ? "active" : ""}`}
            onClick={() => setActive(i)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActive(i);
              }
            }}
          >
            <div className="flex w-full items-start gap-3">
              <img className="shelter-photo" src="https://images.unsplash.com/photo-1722067487040-5c63b4a6d5f1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=75&w=180&h=180" alt="" />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-start justify-between gap-2"><b className="text-sm text-slate-900">{s.name}</b><div className="flex items-center gap-1"><StatusPill tone={s.open < 100 ? "moderate" : "safe"}>{s.open < 100 ? "Limited" : "Available"}</StatusPill>{isAuthority && <Button variant="ghost" className="!p-1" aria-label={`Edit ${s.name}`}><Pencil size={13} /></Button>}</div></div>
                <div className="mt-1.5 text-xs text-slate-500">{s.distance} away • {s.eta} walk</div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><i className="block h-full rounded-full bg-teal-500" style={{ width: `${(s.open / s.capacity) * 100}%` }} /></div>
                  <span className="text-[11px] font-semibold text-slate-500">{s.open}/{s.capacity} spaces</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="card sticky top-24 overflow-hidden self-start">
        <div className="card-header">
          <div><div className="section-title">Evacuation route</div><div className="section-subtitle">Safest available • avoids river crossing</div></div>
          <Button><Navigation size={15} /> Start route</Button>
        </div>
        <div className="relative h-[calc(100vh-14rem)] min-h-[460px]">
          <MapCanvas />
          <div className="route-card">
            <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Route size={20} /></div><div><b className="text-slate-900">1.2 km • 8 min</b><div className="text-xs text-slate-500">Via Upper Dharali Road</div></div></div>
            <div className="mt-3 flex gap-2 text-xs"><StatusPill tone="safe">Route clear</StatusPill><StatusPill tone="info">Low slope risk</StatusPill></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Alerts() {
  const { isAuthority } = useRole();
  const { alerts, sendAlert, markAllRead } = useAlerts();
  const [filter, setFilter] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [area, setArea] = useState("Dharali");
  const [type, setType] = useState<AlertType>("Flood");
  const [severity, setSeverity] = useState<AlertSeverity>("High");
  const [message, setMessage] = useState("Bhagirathi tributary levels are rising. Avoid riverbanks and low-lying crossings.");
  const [confirmation, setConfirmation] = useState("");
  const shown = useMemo(() => alerts.filter((a) => filter === "All" || a.type === filter), [alerts, filter]);
  useEffect(() => markAllRead(), []);
  useEffect(() => {
    const prefilledArea = sessionStorage.getItem("pravaah-alert-area");
    if (isAuthority && prefilledArea) {
      setArea(prefilledArea);
      setFormOpen(true);
      sessionStorage.removeItem("pravaah-alert-area");
    }
  }, [isAuthority]);
  const templates: Record<AlertType, string> = {
    Flood: "Bhagirathi tributary levels are rising. Avoid riverbanks and low-lying crossings.",
    Landslide: "Slope movement has been detected. Avoid the marked road section and unstable slopes.",
    Weather: "Heavy rainfall is expected. Keep emergency supplies ready and avoid unnecessary travel.",
    Evacuation: "Proceed calmly to the nearest verified shelter using the marked safe route.",
    "General Warning": "Follow official instructions. Stay tuned to PRAVAAH for updates.",
  };
  const submitAlert = () => {
    sendAlert({
      area,
      type,
      severity,
      title: `${type} advisory for ${area}`,
      message,
      action: type === "Evacuation" ? "Follow the marked evacuation route now." : "Monitor official updates and follow local safety guidance.",
    });
    setFormOpen(false);
    setConfirmation(`Alert Sent — 1,240 users notified in ${area}.`);
    window.setTimeout(() => setConfirmation(""), 4000);
  };
  return (
    <div className="space-y-5">
      <div className="sr-only" aria-live="polite">{confirmation}</div>
      <div className="page-heading">
        <div><div className="text-2xl font-extrabold text-slate-900">Alerts & advisories</div><div className="mt-1 text-sm text-slate-500">Verified warnings for your region</div></div>
        {isAuthority && <Button variant="danger" onClick={() => setFormOpen(true)}><Send size={16} /> + Send Alert</Button>}
      </div>
      {confirmation && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="confirmation"><Check size={18} /> {confirmation}</motion.div>}
      <div className="filter-row">
        {["All", "Flood", "Landslide", "Weather", "Evacuation"].map((item) => <Button key={item} variant="secondary" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</Button>)}
        <SelectField aria-label="Filter region" className="ml-auto !w-auto"><option>All regions</option><option>Dharali</option><option>Sukhi Gaon</option><option>Kedarpur</option></SelectField>
      </div>
      <div className="space-y-3">
        {shown.map((alert) => {
          const tone = alert.severity === "Critical" ? "critical" : alert.severity === "High" ? "high" : "moderate";
          return (
            <motion.div layout initial={alert.fresh ? { opacity: 0, x: -18 } : false} animate={{ opacity: 1, x: 0 }} className={`alert-card border-${tone} ${alert.fresh ? "fresh" : ""}`} key={alert.id}>
              <div className={`alert-icon status-${tone}`}><Siren size={20} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><StatusPill tone={tone}>{alert.severity}</StatusPill><span className="text-xs font-bold text-slate-500">{alert.type}</span><span className="ml-auto text-xs text-slate-400">{alert.timestamp}</span></div>
                <div className="mt-3 font-extrabold text-slate-900">{alert.title}</div>
                <div className="mt-1 text-sm leading-relaxed text-slate-500">{alert.message}</div>
                <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700"><b>Recommended action:</b> {alert.action}</div>
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400"><MapPin size={13} /> {alert.area} • Sent by District Authority • {alert.timestamp}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
      {formOpen && (
        <div className="modal-backdrop" onMouseDown={() => setFormOpen(false)}>
          <div className="modal animate-rise" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between"><div><div className="text-xl font-extrabold text-slate-900">Send public alert</div><div className="mt-1 text-sm text-slate-500">This message will be distributed across selected areas.</div></div><Button variant="ghost" className="!p-1" onClick={() => setFormOpen(false)}><X /></Button></div>
            <div className="mt-6 space-y-4">
              <label className="form-label">Area<SelectField value={area} onChange={(e) => setArea(e.target.value)}><option>Dharali</option><option>Sukhi Gaon</option><option>Kedarpur</option><option>Bamoli</option><option>All Areas</option></SelectField></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-label">Type<SelectField value={type} onChange={(e) => { const next = e.target.value as AlertType; setType(next); setMessage(templates[next]); }}><option>Flood</option><option>Landslide</option><option>Weather</option><option>Evacuation</option></SelectField></label>
                <label className="form-label">Severity<SelectField value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}><option>Moderate</option><option>High</option><option>Critical</option></SelectField></label>
              </div>
              <div className="severity-preview"><span>Severity preview</span><StatusPill tone={severity.toLowerCase()}>{severity}</StatusPill></div>
              <label className="form-label">Message{createElement("textarea", { className: "field min-h-28 resize-none", value: message, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value), placeholder: "Write clear, actionable safety guidance…" })}</label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button variant="danger" onClick={submitAlert}><Send size={16} /> Send Alert</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const screenPaths: Record<Screen, string> = {
  landing: "/",
  predict: "/predict",
    dashboard: "/dashboard",
  "authority-dashboard": "/authority-dashboard",
  map: "/risk-map",
  forecast: "/forecast",
  landslide: "/landslide",
  shelters: "/shelters",
  alerts: "/alerts",
  sensors: "/sensors",
  analytics: "/analytics",
};

function ProductApp() {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { role, setRole, isAuthority } = useRole();
  const navigate = (next: Screen) => {
    routerNavigate(screenPaths[next]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const screen = (Object.entries(screenPaths).find(([, path]) => path === location.pathname)?.[0] ?? "dashboard") as Screen;
  if (location.pathname === "/") return <Landing onNavigate={navigate} authority={isAuthority} setAuthority={(value) => setRole(value ? "authority" : "user")} />;
  return (
    <>
      <LocationPromptModal />
      <AppShell screen={screen} onNavigate={navigate}>
        <Routes>
          <RouterRoute path="/predict" element={<PredictPage />} />
          <RouterRoute path="/dashboard" element={<Dashboard onNavigate={navigate} />} />
          <RouterRoute path="/authority-dashboard" element={isAuthority ? <AuthorityDashboard onNavigate={navigate} /> : <Navigate to="/dashboard" replace />} />
          <RouterRoute path="/risk-map" element={<RiskMap onNavigate={navigate} />} />
          <RouterRoute path="/forecast" element={<Forecast />} />
          <RouterRoute path="/landslide" element={<Landslide />} />
          <RouterRoute path="/shelters" element={<Shelters />} />
          <RouterRoute path="/alerts" element={<Alerts />} />
          <RouterRoute path="/sensors" element={isAuthority ? <Sensors /> : <Navigate to="/dashboard" replace />} />
          <RouterRoute path="/analytics" element={isAuthority ? <Analytics /> : <Navigate to="/dashboard" replace />} />
          <RouterRoute path="*" element={<Navigate to={role === "authority" ? "/authority-dashboard" : "/dashboard"} replace />} />
        </Routes>
      </AppShell>
    </>
  );
}

export default function App() {
  return <BrowserRouter><RoleProvider><AlertProvider><RiskProvider><ProductApp /></RiskProvider></AlertProvider></RoleProvider></BrowserRouter>;
}
