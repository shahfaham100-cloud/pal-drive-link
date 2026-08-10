import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { mapsUrl } from "@/lib/schedule";

const BROWSER_KEY = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
  | string
  | undefined;
const TRACKING_ID = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as
  | string
  | undefined;

let mapsPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (!BROWSER_KEY) return Promise.reject(new Error("no key"));
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).google?.maps?.importLibrary) return resolve();
    (window as any).__initGmaps = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&libraries=places&loading=async&callback=__initGmaps${
      TRACKING_ID ? `&channel=${TRACKING_ID}` : ""
    }`;
    s.async = true;
    s.onerror = () => reject(new Error("failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

interface Suggestion {
  text: string;
  placeId: string;
}

/**
 * Address field with Google Places suggestions when the Maps connector is
 * available, and plain manual typing otherwise.
 */
export function AddressInput({
  value,
  onChange,
  onSuburbChange,
  placeholder = "Street address",
}: {
  value: string;
  onChange: (v: string) => void;
  onSuburbChange?: (suburb: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const tokenRef = useRef<any>(null);

  useEffect(() => {
    if (!BROWSER_KEY) return;
    loadMaps()
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, []);

  useEffect(() => {
    if (!ready || !value || value.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const places: any = await (window as any).google.maps.importLibrary("places");
        if (!tokenRef.current) tokenRef.current = new places.AutocompleteSessionToken();
        const { suggestions: raw } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
          { input: value, sessionToken: tokenRef.current },
        );
        if (cancelled) return;
        setSuggestions(
          (raw ?? []).slice(0, 5).map((s: any) => ({
            text: s.placePrediction?.text?.toString() ?? "",
            placeId: s.placePrediction?.placeId ?? "",
          })),
        );
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, ready]);

  const pick = (s: Suggestion) => {
    onChange(s.text);
    setOpen(false);
    setSuggestions([]);
    tokenRef.current = null;
    const parts = s.text.split(",").map((p) => p.trim());
    if (onSuburbChange && parts.length > 1) onSuburbChange(parts[1]);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onFocus={() => setOpen(true)}
            autoComplete="off"
          />
        </div>
        {value && (
          <a
            href={mapsUrl(value)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border px-3 text-xs text-muted-foreground hover:bg-slate-50"
            title="Open in Google Maps"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Map
          </a>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-md">
          {suggestions.map((s) => (
            <button
              key={s.placeId || s.text}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
