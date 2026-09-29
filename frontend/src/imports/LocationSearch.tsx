import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Search, X, Loader } from "lucide-react";
import { useRisk, type Location } from "../context/RiskContext";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string; town?: string; village?: string;
    county?: string; state?: string; country?: string;
  };
};

function getShortName(r: NominatimResult): string {
  const a = r.address;
  return a.village || a.town || a.city || r.display_name.split(",")[0];
}

function getSubtitle(r: NominatimResult): string {
  const a = r.address;
  const parts = [a.county, a.state, a.country].filter(Boolean);
  return parts.slice(0, 3).join(", ");
}

type Props = {
  placeholder?: string;
  className?: string;
  onSelect?: (loc: Location) => void;
};

export function LocationSearch({ placeholder = "Search place or village…", className = "", onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { setSelectedLocation } = useRisk();

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=6&addressdetails=1&viewbox=77.5,31.5,80.5,28.5&bounded=0`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 380);
  };

  const handleSelect = (r: NominatimResult) => {
    const loc: Location = {
      name: getShortName(r),
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
    };
    setSelectedLocation(loc);
    onSelect?.(loc);
    setQuery(getShortName(r));
    setOpen(false);
  };

  const handleClear = () => { setQuery(""); setResults([]); setOpen(false); };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={`location-search-wrap ${className}`} ref={wrapRef}>
      <Search size={15} className="location-search-icon" />
      <input
        className="location-search-input"
        type="search"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
        aria-label="Search location"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {loading && (
        <Loader size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-teal-500 animate-spin" />
      )}
      {!loading && query && (
        <button
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
      {open && results.length > 0 && (
        <div className="location-search-results" role="listbox">
          {results.map((r) => (
            <div
              key={r.place_id}
              className="location-result-item"
              role="option"
              onClick={() => handleSelect(r)}
            >
              <MapPin size={15} className="text-teal-500 mt-0.5 shrink-0" />
              <div>
                <b>{getShortName(r)}</b>
                <small>{getSubtitle(r)}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
