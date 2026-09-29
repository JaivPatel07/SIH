import { useState } from "react";
import { MapPin, Crosshair, Loader, ArrowRight } from "lucide-react";
import { useRisk } from "../context/RiskContext";
import { LocationSearch } from "./LocationSearch";

export function LocationPromptModal() {
  const { isLocationSet, setSelectedLocation, setIsLocationSet } = useRisk();
  const [geoLoading, setGeoLoading] = useState(false);
  
  if (isLocationSet) return null;

  const handleUseCurrent = () => {
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
        },
        (err) => {
          console.error(err);
          setGeoLoading(false);
          alert("Could not get location automatically. Please search manually.");
        }
      );
    } else {
      setGeoLoading(false);
      alert("Geolocation is not supported by your browser.");
    }
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
              PRAVAAH needs your area of interest to fetch live flood and landslide risk.
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
              <span className="text-sm">Use my current location</span>
            </span>
            <ArrowRight size={18} className="opacity-60 shrink-0" />
          </button>

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
            onClick={() => setIsLocationSet(true)}
            className="w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600 pt-1"
          >
            Skip for now — show the default Dharali area
          </button>
        </div>
      </div>
    </div>
  );
}