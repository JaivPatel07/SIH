import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, CloudRain, Droplets, Mountain,
  MapPin, RefreshCw, TrendingUp, Zap, Info, ChevronRight,
  Waves, BarChart3, Thermometer, Wind, Activity
} from "lucide-react";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis
} from "recharts";
import { useRisk } from "../context/RiskContext";
import { LocationSearch } from "./LocationSearch";
import type { RiskEngineResponse, RiskHistoryEntry } from "../services/riskEngineService";

/* ─── helpers ─────────────────────────────────────────────────── */
function getRiskColor(cat: string | null | undefined) {
  switch ((cat || "").toLowerCase()) {
    case "very high": case "critical": return { text: "text-red-600", bg: "bg-red-50", border: "border-red-200", bar: "#dc2626", ring: "ring-red-500" };
    case "high": return { text: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", bar: "#f97316", ring: "ring-orange-500" };
    case "moderate": return { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", bar: "#f59e0b", ring: "ring-amber-500" };
    default: return { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", bar: "#059669", ring: "ring-emerald-500" };
  }
}

function pct(val: number | null | undefined) {
  if (val == null) return 0;
  return Math.min(Math.round(val * 100), 100);
}

function fmt(val: number | null | undefined, unit = "") {
  if (val == null) return "—";
  return `${typeof val === "number" && val % 1 !== 0 ? val.toFixed(2) : val}${unit ? " " + unit : ""}`;
}

/* ─── Loading skeleton ─────────────────────────────────────────── */
function Skeleton({ h = "1rem", w = "100%" }: { h?: string; w?: string }) {
  return <div className="shimmer rounded-lg" style={{ height: h, width: w }} />;
}

/* ─── Gauge card ───────────────────────────────────────────────── */
function GaugeCard({ label, value, max = 100, color, unit = "%", note }: {
  label: string; value: number; max?: number; color: string; unit?: string; note?: string;
}) {
  const pctVal = Math.min((value / max) * 100, 100);
  const data = [{ name: label, value: pctVal, fill: color }];
  return (
    <div className="predict-metric-card flex flex-col items-center py-5 px-3">
      <div className="relative w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={225} endAngle={-45} barSize={10}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background={{ fill: "#f1f5f9" }} dataKey="value" angleAxisId={0} cornerRadius={5} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color }}>{value}{unit}</span>
          {note && <span className="text-[10px] text-slate-400 mt-0.5 font-medium">{note}</span>}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600 text-center font-semibold">{label}</p>
    </div>
  );
}

/* ─── Data source badge ─────────────────────────────────────────── */
function SourceBadge({ label, source, status }: { label: string; source: string; status: string }) {
  const ok = status === "available";
  return (
    <div className={`flex items-start gap-2 text-xs rounded-lg p-2.5 border ${ok ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-500"}`}>
      {ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <Info size={13} className="shrink-0 mt-0.5 text-slate-400" />}
      <div>
        <b className="block font-semibold">{label}</b>
        <span className="opacity-70">{source}</span>
      </div>
    </div>
  );
}

/* ─── Env data row ──────────────────────────────────────────────── */
function EnvRow({ icon: Icon, label, value, unit, sub, color = "#64748b" }: {
  icon: any; label: string; value: string | number | null | undefined; unit?: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className="grid place-items-center w-7 h-7 rounded-lg" style={{ background: color + "15" }}>
          <Icon size={14} style={{ color }} />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-700">{label}</div>
          {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-bold text-slate-800">
          {value == null ? "—" : value}
          {unit && <span className="text-xs text-slate-400 font-normal ml-1">{unit}</span>}
        </span>
      </div>
    </div>
  );
}

/* ─── History chart ─────────────────────────────────────────────── */
function HistoryChart({ data }: { data: RiskHistoryEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-36 text-slate-400 text-sm gap-2">
        <BarChart3 size={28} className="opacity-30" />
        <span>Not enough historical data yet.<br /><span className="text-xs">Check again after more location queries.</span></span>
      </div>
    );
  }
  const chartData = [...data].reverse().map((r, i) => ({
    t: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    risk: r.risk_score != null ? Math.round(r.risk_score * 100) : 0,
    rain: r.rainfall_1d ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gRisk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gRain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: "0.65rem", border: "none", boxShadow: "0 4px 20px rgba(15,23,42,.12)", fontSize: "0.75rem" }} />
        <Area type="monotone" dataKey="risk" stroke="#dc2626" strokeWidth={2} fill="url(#gRisk)" name="Risk %" />
        <Area type="monotone" dataKey="rain" stroke="#2563eb" strokeWidth={2} fill="url(#gRain)" name="Rain 1d (mm)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Main Predict Page ─────────────────────────────────────────── */
export function PredictPage() {
  const { selectedLocation, setSelectedLocation, riskData, historyData, loading, error, refreshRiskData } = useRisk();
  const [refreshing, setRefreshing] = useState(false);
  const [simModalOpen, setSimModalOpen] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshRiskData();
    setRefreshing(false);
  };

  const risk = riskData;
  const rc = getRiskColor(risk?.risk_category);
  const floodPct = pct(risk?.model1?.flood_probability);
  const landslidePct = pct(risk?.current_landslide_risk);

  return (
    <div className="predict-page space-y-5">
      {/* ── Hero search bar ── */}
      <div className="predict-hero">
        <div className="predict-hero-inner">
          <div className="flex items-center gap-2 mb-3">
            <Waves size={18} className="text-teal-400" />
            <span className="text-sm font-semibold text-teal-300 tracking-wide">PRAVAAH · Location Prediction</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white mb-1">
            Get live risk prediction for any location
          </h1>
          <p className="text-slate-400 text-sm mb-5">
            Search a village, town, or click on the map — PRAVAAH fetches real environmental data and runs flood + landslide models.
          </p>

          {/* Search bar */}
          <div className="predict-search-wrap">
            <LocationSearch
              placeholder="Search any place in Uttarakhand…"
              className="predict-search"
            />
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="predict-refresh-btn"
              title="Refresh data"
            >
              <RefreshCw size={16} className={loading || refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setSimModalOpen(true)}
              className="predict-refresh-btn !bg-violet-600 hover:!bg-violet-700 text-white !border-violet-600 sm:ml-2"
              title="Simulate Scenario"
            >
              <Zap size={16} />
              <span className="hidden sm:inline">Simulate</span>
            </button>
          </div>

          {/* Selected location chip */}
          {selectedLocation && (
            <motion.div
              key={selectedLocation.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 text-sm text-white backdrop-blur-sm"
            >
              <MapPin size={13} className="text-teal-300" />
              <span className="font-semibold">{selectedLocation.name}</span>
              <span className="text-slate-400 text-xs">
                {selectedLocation.latitude.toFixed(4)}°N, {selectedLocation.longitude.toFixed(4)}°E
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Error state ── */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700"
          >
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <b className="block text-sm font-semibold">Backend unavailable</b>
              <span className="text-xs mt-0.5 block opacity-80">{error} Check that the Django API is running (the dev server proxies <code>/api</code> to it) and try again.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading skeletons ── */}
      {loading && (
        <div className="space-y-4">
          <div className="predict-grid-top">
            <div className="card p-5 space-y-3"><Skeleton h="2rem" w="60%" /><Skeleton h="6rem" /><Skeleton h="1rem" w="80%" /></div>
            <div className="card p-5 space-y-3"><Skeleton h="2rem" w="60%" /><Skeleton h="6rem" /><Skeleton h="1rem" w="80%" /></div>
            <div className="card p-5 space-y-3"><Skeleton h="2rem" w="60%" /><Skeleton h="6rem" /><Skeleton h="1rem" w="80%" /></div>
          </div>
          <div className="card p-5 space-y-3">
            <Skeleton h="1.2rem" w="40%" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} h="5rem" />)}
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && risk && (
        <motion.div
          key={selectedLocation.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-5"
        >
          {/* Top 3 model cards */}
          <div className="predict-grid-top">

            {/* Overall Risk */}
            <div className={`card p-5 border-2 ${rc.border} ${rc.bg}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Overall Risk</div>
                  <div className={`text-3xl font-black ${rc.text}`}>{risk.risk_category || "Unknown"}</div>
                  <div className="text-xs text-slate-500 mt-1">{risk.risk_explanation?.confidence || "Prototype estimate"}</div>
                </div>
                <div className={`grid place-items-center w-12 h-12 rounded-xl ${rc.bg} border ${rc.border}`}>
                  <AlertTriangle size={22} className={rc.text} />
                </div>
              </div>

              {/* Risk bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Risk Score</span>
                  <span className={`font-bold ${rc.text}`}>{landslidePct}%</span>
                </div>
                <div className="h-2.5 bg-white rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${landslidePct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: rc.bar }}
                  />
                </div>
              </div>

              {/* Dynamic trigger */}
              {risk.dynamic_trigger_score != null && (
                <div className="mt-3 text-xs text-slate-500">
                  Dynamic trigger: <b className={rc.text}>{risk.dynamic_trigger_score.toFixed(3)}</b>
                </div>
              )}
            </div>

            {/* Flood Model */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Flood Probability</div>
                  <div className="text-3xl font-black text-blue-600">{floodPct}%</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Next {risk.model1?.prediction_horizon_hours || 3}h window
                  </div>
                </div>
                <div className="grid place-items-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100">
                  <Waves size={22} className="text-blue-500" />
                </div>
              </div>

              {/* Flood bar */}
              <div className="space-y-2">
                <div className="h-2.5 bg-blue-50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${floodPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
                  />
                </div>
              </div>

              {risk.model1?.prototype_mode && (
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                  <Info size={11} /> Prototype model — not operationally validated
                </div>
              )}
            </div>

            {/* Landslide */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Landslide Risk</div>
                  <div className="text-3xl font-black text-orange-600">{landslidePct}%</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Static susceptibility + dynamic trigger
                  </div>
                </div>
                <div className="grid place-items-center w-12 h-12 rounded-xl bg-orange-50 border border-orange-100">
                  <Mountain size={22} className="text-orange-500" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-2.5 bg-orange-50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${landslidePct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
                  />
                </div>
              </div>

              {risk.static_susceptibility?.value != null && (
                <div className="mt-3 text-xs text-slate-500">
                  Static susceptibility: <b className="text-slate-700">{risk.static_susceptibility.value.toFixed(3)}</b>
                </div>
              )}
            </div>
          </div>

          {/* Why this risk? */}
          {risk.risk_explanation && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-amber-500" />
                <h3 className="section-title">Why this risk?</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">{risk.risk_explanation.summary}</p>
              <div className="grid gap-2.5">
                {risk.risk_explanation.drivers.map((d, i) => (
                  <div key={i} className="flex gap-2.5 items-start bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    <ChevronRight size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-slate-700 leading-relaxed">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Environmental inputs */}
          <div className="predict-grid-bottom">

            {/* Rainfall block */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <CloudRain size={16} className="text-blue-500" />
                <h3 className="section-title">Rainfall Inputs</h3>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${risk.rainfall.status === "available" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {risk.rainfall.status}
                </span>
              </div>

              <div className="space-y-0">
                <EnvRow icon={CloudRain} label="Observed (1-day)" value={fmt(risk.rainfall.rain_1d?.value)} unit="mm" sub="Open-Meteo archive" color="#2563eb" />
                <EnvRow icon={CloudRain} label="Observed (3-day)" value={fmt(risk.rainfall.rain_3d?.value)} unit="mm" sub="Open-Meteo archive" color="#3b82f6" />
                <EnvRow icon={CloudRain} label="Observed (15-day)" value={fmt(risk.rainfall.rain_15d?.value)} unit="mm" sub="Open-Meteo archive" color="#60a5fa" />
                <EnvRow icon={Activity} label="Forecast (24h)" value={fmt(risk.rainfall.forecast_24h?.value)} unit="mm" sub="Open-Meteo forecast" color="#06b6d4" />
                <EnvRow icon={Activity} label="Forecast (3-day)" value={fmt(risk.rainfall.forecast_3d?.value)} unit="mm" sub="Open-Meteo forecast" color="#0891b2" />
              </div>

              {risk.rainfall.observed_at && (
                <div className="mt-3 text-[10px] text-slate-400">Observed: {new Date(risk.rainfall.observed_at).toLocaleString()}</div>
              )}
            </div>

            {/* Soil + Elevation + Susceptibility */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Droplets size={16} className="text-teal-500" />
                <h3 className="section-title">Soil, Terrain & Susceptibility</h3>
              </div>

              <div className="space-y-0">
                <EnvRow
                  icon={Droplets} label="Soil Moisture" color="#0d9488"
                  value={fmt(risk.soil_moisture?.value)}
                  unit={risk.soil_moisture?.unit || "m³/m³"}
                  sub={risk.soil_moisture?.source}
                />
                <EnvRow
                  icon={Mountain} label="Elevation" color="#7c3aed"
                  value={fmt(risk.elevation?.value)}
                  unit={risk.elevation?.unit || "m"}
                  sub={risk.elevation?.source}
                />
                <EnvRow
                  icon={TrendingUp} label="Static Susceptibility" color="#f97316"
                  value={risk.static_susceptibility?.value != null ? risk.static_susceptibility.value.toFixed(3) : null}
                  unit=""
                  sub={risk.static_susceptibility?.status}
                />
                <EnvRow
                  icon={AlertTriangle} label="Dynamic Trigger Score" color="#dc2626"
                  value={risk.dynamic_trigger_score != null ? risk.dynamic_trigger_score.toFixed(3) : null}
                  unit=""
                  sub="Rainfall + soil moisture + susceptibility"
                />
              </div>
            </div>
          </div>

          {/* Data sources + History */}
          <div className="predict-grid-bottom">

            {/* Data transparency */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info size={16} className="text-slate-400" />
                <h3 className="section-title">Data Sources</h3>
              </div>
              <div className="grid gap-2">
                <SourceBadge
                  label="Rainfall (observed + forecast)"
                  source={risk.rainfall.source || "Open-Meteo"}
                  status={risk.rainfall.status}
                />
                <SourceBadge
                  label="Soil Moisture"
                  source={risk.soil_moisture?.source || "ERA5-Land"}
                  status={risk.soil_moisture?.status}
                />
                <SourceBadge
                  label="Elevation"
                  source={risk.elevation?.source || "Open-Meteo Elevation API"}
                  status={risk.elevation?.status}
                />
                <SourceBadge
                  label="Static Susceptibility"
                  source={risk.static_susceptibility?.source || "Prototype layer"}
                  status={risk.static_susceptibility?.status}
                />
                <SourceBadge
                  label="Flood Model (Model 1)"
                  source="Prototype ML — synthetic training data"
                  status={risk.model1?.prototype_mode ? "prototype" : "available"}
                />
              </div>

              {risk.prototype_notes && (
                <div className="mt-4 space-y-1">
                  {risk.prototype_notes.map((n, i) => (
                    <div key={i} className="text-[10px] text-slate-400 flex gap-1.5 items-start">
                      <span className="text-slate-300 mt-0.5">⚠</span>{n}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Risk History Chart */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-violet-500" />
                <h3 className="section-title">Risk History</h3>
                <span className="ml-auto text-[10px] text-slate-400">{historyData.length} records</span>
              </div>
              <HistoryChart data={historyData} />
              <div className="mt-3 flex gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-1 inline-block rounded bg-red-500"></span>Risk %</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1 inline-block rounded bg-blue-500"></span>Rainfall (mm)</span>
              </div>
            </div>
          </div>

          {/* Model 1 feature payload (collapsible) */}
          {risk.model1?.feature_payload && Object.keys(risk.model1.feature_payload).length > 0 && (
            <details className="card p-5 group">
              <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
                <Zap size={15} className="text-violet-500" />
                <span className="section-title">Model 1 Feature Inputs</span>
                <span className="ml-auto text-xs text-slate-400 group-open:hidden">Show</span>
                <span className="ml-auto text-xs text-slate-400 hidden group-open:inline">Hide</span>
              </summary>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Object.entries(risk.model1.feature_payload).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{k.replace(/_/g, " ")}</div>
                    <div className="text-sm font-bold text-slate-700 mt-0.5">{typeof v === "number" ? v.toFixed(3) : v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-slate-400">These are the actual feature values sent to the prototype flood model.</div>
            </details>
          )}
        </motion.div>
      )}
      
      {/* Simulation Modal */}
      {simModalOpen && (
        <SimulationModal 
          isOpen={simModalOpen} 
          onClose={() => setSimModalOpen(false)} 
          baseRisk={riskData} 
        />
      )}
    </div>
  );
}

function SimulationModal({ isOpen, onClose, baseRisk }: { isOpen: boolean, onClose: () => void, baseRisk: any }) {
  const [rain, setRain] = useState(150);

  if (!isOpen) return null;

  const simRisk = Math.min(((baseRisk?.static_susceptibility?.value || 0.2) * 0.3) + (rain / 200), 0.99);
  const isDanger = simRisk > 0.5;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal animate-rise" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-black text-slate-900">What-If Simulation</h3>
            <p className="text-sm text-slate-500 mt-1">Test extreme rainfall scenarios for {baseRisk?.latitude ? "this location" : "a location"}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Hypothetical Rainfall (mm)</label>
            <input 
              type="number" 
              className="field mt-2 w-full text-lg font-bold" 
              value={rain} 
              onChange={e => setRain(Number(e.target.value))} 
            />
          </div>
          
          <div className={`p-4 rounded-xl border ${isDanger ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Simulated Outcome</div>
            <div className={`text-2xl font-black ${isDanger ? 'text-red-700' : 'text-emerald-700'}`}>
               {isDanger ? 'High Risk / Critical' : 'Safe / Moderate'}
            </div>
            <div className={`text-xs mt-2 opacity-80 ${isDanger ? 'text-red-900' : 'text-emerald-900'}`}>
               Based on a local simulation, {rain}mm of sudden rain would push the dynamic trigger score to approx {(simRisk * 10).toFixed(2)}. 
               {isDanger ? " This indicates likely flooding or landslides." : " The terrain could likely absorb this."}
            </div>
          </div>
        </div>
        
        <button onClick={onClose} className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">Close Simulator</button>
      </div>
    </div>
  )
}
