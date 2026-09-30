import { useRef, useState } from "react";
import { MapPin, Crosshair, Loader, ArrowRight } from "lucide-react";
import { useRisk } from "../context/RiskContext";
import { LocationSearch } from "./LocationSearch";

export function LocationPromptModal() {
  const { isLocationSet, setSelectedLocation } = useRisk();
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const geoAttempt = useRef(0);
  const geoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  if (isLocationSet) return null;

  const handleUseCurrent = () => {
    const attempt = ++geoAttempt.current;
    setGeoError("");
    setGeoLoading(true);
    if (geoTimeout.current) window.clearTimeout(geoTimeout.current);
    geoTimeout.current = window.setTimeout(() => {
      if (geoAttempt.current !== attempt) return;
      setGeoLoading(false);
      setGeoError("Location access is taking too long. Search for a place or use the default area below.");
    }, 8000);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (geoAttempt.current !== attempt) return;
          if (geoTimeout.current) window.clearTimeout(geoTimeout.current);
          // Use coordinates immediately. Reverse geocoding is optional and
          // must never keep the location dialog waiting.
          setSelectedLocation({ name: "Current location", latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {
          if (geoAttempt.current !== attempt) return;
          if (geoTimeout.current) window.clearTimeout(geoTimeout.current);
          setGeoLoading(false);
          setGeoError("We could not get your location. Allow location access or search for a place below.");
        },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
      );
    } else {
      if (geoTimeout.current) window.clearTimeout(geoTimeout.current);
      setGeoLoading(false);
      setGeoError("Your browser does not support location access. Please search for a place below.");
    }
  };

  const handleUseDefaultArea = () => {
    geoAttempt.current += 1;
    if (geoTimeout.current) window.clearTimeout(geoTimeout.current);
    setGeoLoading(false);
    setSelectedLocation({ name: "Dharali", latitude: 30.6739, longitude: 78.4827 });
  };

  return (
    <div className="modal-backdrop">
      <div className="prompt-modal animate-rise">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
            <MapPin size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Where are you located?</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Choose an area to view available environmental inputs and prototype risk estimates.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <button
            onClick={handleUseCurrent}
            disabled={geoLoading}
            className="w-full flex items-center justify-between gap-3 bg-teal-50 hover:bg-teal-100 disabled:opacity-60 text-teal-700 font-semibold p-4 rounded-xl transition-colors border border-teal-200 text-left"
          >
            <span className="flex items-center gap-3">
              {geoLoading ? <Loader size={20} className="animate-spin" /> : <Crosshair size={20} />}
              <span className="text-sm">{geoLoading ? "Getting your location…" : "Use my current location"}</span>
            </span>
            <ArrowRight size={18} className="opacity-60 shrink-0" />
          </button>
          {geoError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800" role="alert">{geoError}</p>}

          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[.14em] whitespace-nowrap">or search manually</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <div className="relative z-50">
            <LocationSearch
              placeholder="Search for a village, city, or district…"
              className="!max-w-none"
            />
          </div>

          <button
            onClick={handleUseDefaultArea}
            className="w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600 pt-1"
          >
            Skip for now — show the default Dharali area
          </button>
        </div>
      </div>
    </div>
  );
}
