import { useEffect, useRef, useState } from "react";
import { Search, MapPin, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

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
    (window as any).__initGmapsDash = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__initGmapsDash${
      TRACKING_ID ? `&channel=${TRACKING_ID}` : ""
    }`;
    s.async = true;
    s.onerror = () => reject(new Error("failed"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

interface ClientHit {
  id: string;
  name: string;
  address: string | null;
  suburb: string | null;
  phone: string | null;
}

function fullAddress(c: ClientHit) {
  return [c.address, c.suburb].filter(Boolean).join(", ");
}

/**
 * Dashboard map with a client search bar. Searching by name, phone, address or
 * suburb pans the map to that client's location.
 */
export function ClientMapPanel() {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClientHit | null>(null);
  const [ready, setReady] = useState(false);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!BROWSER_KEY) return;
    let cancelled = false;
    loadMaps()
      .then(async () => {
        if (cancelled || !mapDiv.current) return;
        const { Map } = (await (window as any).google.maps.importLibrary("maps")) as any;
        mapRef.current = new Map(mapDiv.current, {
          center: { lat: -31.95, lng: 115.86 },
          zoom: 11,
          mapTypeControl: true,
          streetViewControl: false,
        });
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const { data } = await supabase
        .from("clients")
        .select("id,name,address,suburb,phone")
        .or(
          `name.ilike.${like},phone.ilike.${like},address.ilike.${like},suburb.ilike.${like}`,
        )
        .limit(8);
      if (!cancelled) setHits((data as ClientHit[]) ?? []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  const pick = async (c: ClientHit) => {
    setSelected(c);
    setOpen(false);
    setTerm(c.name);
    const addr = fullAddress(c);
    if (!addr || !ready || !mapRef.current) return;
    try {
      const { Geocoder } = (await (window as any).google.maps.importLibrary(
        "geocoding",
      )) as any;
      const res = await new Geocoder().geocode({ address: addr });
      const loc = res?.results?.[0]?.geometry?.location;
      if (!loc) return;
      mapRef.current.panTo(loc);
      window.setTimeout(() => mapRef.current?.setZoom(16), 400);
      if (markerRef.current) markerRef.current.setMap(null);
      const { Marker } = (await (window as any).google.maps.importLibrary("marker")) as any;
      markerRef.current = new Marker({
        map: mapRef.current,
        position: loc,
        title: c.name,
        animation: (window as any).google.maps.Animation.DROP,
      });
    } catch {
      /* geocoding unavailable */
    }
  };

  const addr = selected ? fullAddress(selected) : "";

  return (
    <div className="relative h-full overflow-hidden rounded-lg border bg-card">
      <div className="absolute inset-x-0 top-0 z-20 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 bg-background pl-9 shadow-md"
            placeholder="Search client by name, phone, address or suburb…"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && hits.length > 0 && (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-background shadow-lg">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(h)}
                >
                  <div className="font-medium">{h.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[fullAddress(h), h.phone].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {ready ? (
        <div ref={mapDiv} className="h-full w-full" />
      ) : (
        <iframe
          title="Client map"
          className="h-full w-full"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(
            addr || "Perth WA",
          )}&z=${addr ? 16 : 11}&output=embed`}
        />
      )}

      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-2 backdrop-blur">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{selected.name}</div>
            <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {addr || "No address on file"}
            </div>
          </div>
          {addr && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
          )}
        </div>
      )}
    </div>
  );
}
