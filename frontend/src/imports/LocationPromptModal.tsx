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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-rise">
        <div className="flex items-center gap-3 mb-4 text-teal-600">
          <MapPin size={24} />
          <h2 className="text-xl font-bold text-slate-900">Where are you located?</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          To provide live disaster risk assessment and alerts, we need to know your area of interest.
        </p>

        <div className="space-y-4">
          <button 
            onClick={handleUseCurrent}
            disabled={geoLoading}
            className="w-full flex items-center justify-between bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold p-4 rounded-xl transition-colors border border-teal-200"
          >
            <div className="flex items-center gap-3">
              {geoLoading ? <Loader size={20} className="animate-spin" /> : <Crosshair size={20} />}
              <span>Use my current location</span>
            </div>
            <ArrowRight size={18} className="opacity-50" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">or search manually</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          <div className="relative z-50">
            <LocationSearch 
              placeholder="Search for a village, city, or district..." 
              className="w-full"
            />
          </div>
          
          <button 
            onClick={() => setIsLocationSet(true)}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 mt-4 pt-2"
          >
            Skip for now (use default Dharali data)
          </button>
        </div>
      </div>
    </div>
  );
}
