"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Feature, LineString, FeatureCollection, Point } from "geojson";

import { useUserLocation } from "../_hooks/useUserLocation";
import { useNotifications } from "../_hooks/useNotifications";
import { useHazardCache, type CachedHazard } from "../_hooks/useHazardCache";

import ReportButton from "./ReportButton";
import BottomSheet from "./BottomSheet";
import RoutePanel from "./RoutePanel";
import WarningBanner from "./WarningBanner";

// ── Types ─────────────────────────────────────────────────────────────────
type Place = {
  place_name: string;
  center: [number, number];
};

interface RouteInfo {
  distance: number;
  duration: number;
  hazardCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const PROXIMITY_WARNING_RADIUS = 300; // meters

// ── Helpers ───────────────────────────────────────────────────────────────
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1),
    φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function severityColor(severity: number): string {
  if (severity >= 3) return "#ef4444"; // high → red
  if (severity >= 2) return "#f97316"; // medium → orange
  return "#eab308"; // low → yellow
}

// ── Component ─────────────────────────────────────────────────────────────
export default function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const startMarker = useRef<maplibregl.Marker | null>(null);
  const endMarker = useRef<maplibregl.Marker | null>(null);
  const activePopup = useRef<maplibregl.Popup | null>(null);
  const notifiedHazardIds = useRef<Set<number>>(new Set());

  // Search state
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromResults, setFromResults] = useState<Place[]>([]);
  const [toResults, setToResults] = useState<Place[]>([]);

  // Route state
  const [start, setStart] = useState<[number, number] | null>(null);
  const [end, setEnd] = useState<[number, number] | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // UI state
  const [warning, setWarning] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [hazards, setHazards] = useState<CachedHazard[]>([]);

  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const { position } = useUserLocation();
  const { permission, requestPermission, sendNotification } = useNotifications();
  const { getCache, setCache } = useHazardCache();

  // ── Map Init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current || !apiKey) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${apiKey}`,
      center: [88.3639, 22.5726],
      zoom: 13,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.current.on("load", () => {
      initHazardLayer();
      setIsMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [apiKey]);

  // ── Hazard Layer Init ─────────────────────────────────────────────────────
  const initHazardLayer = () => {
    const m = map.current;
    if (!m) return;

    // GeoJSON source (starts empty)
    m.addSource("hazards", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    // Glow ring
    m.addLayer({
      id: "hazard-glow",
      type: "circle",
      source: "hazards",
      paint: {
        "circle-radius": 20,
        "circle-color": [
          "match",
          ["get", "severity"],
          1, "#eab308",
          2, "#f97316",
          3, "#ef4444",
          "#eab308",
        ],
        "circle-opacity": 0.12,
        "circle-blur": 1,
      },
    });

    // Main dot
    m.addLayer({
      id: "hazard-circles",
      type: "circle",
      source: "hazards",
      paint: {
        "circle-radius": 10,
        "circle-color": [
          "match",
          ["get", "severity"],
          1, "#eab308",
          2, "#f97316",
          3, "#ef4444",
          "#eab308",
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.92,
      },
    });

    // Click popup
    m.on("click", "hazard-circles", (e) => {
      if (!e.features?.[0]) return;
      const props = e.features[0].properties as {
        id: number;
        type: string;
        severity: number;
      };
      const geom = e.features[0].geometry as Point;
      const coords = geom.coordinates as [number, number];

      if (activePopup.current) activePopup.current.remove();

      const color = severityColor(props.severity || 1);
      const severityLabel = ["", "Low", "Medium", "High"][props.severity] ?? "Low";

      activePopup.current = new maplibregl.Popup({ offset: 16, maxWidth: "220px" })
        .setLngLat(coords)
        .setHTML(
          `<div style="padding:14px 16px;font-family:system-ui,sans-serif">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <span style="width:11px;height:11px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
              <strong style="color:#fff;font-size:15px;text-transform:capitalize">${props.type}</strong>
            </div>
            <span style="display:inline-flex;align-items:center;gap:4px;background:${color}22;color:${color};border:1px solid ${color}55;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700">
              ${severityLabel} severity
            </span>
          </div>`
        )
        .addTo(m);
    });

    m.on("mouseenter", "hazard-circles", () => {
      m.getCanvas().style.cursor = "pointer";
    });
    m.on("mouseleave", "hazard-circles", () => {
      m.getCanvas().style.cursor = "";
    });
  };

  // ── Update Hazard Source Data ─────────────────────────────────────────────
  const updateHazardLayer = useCallback((hazardList: CachedHazard[]) => {
    const m = map.current;
    if (!m || !m.getSource("hazards")) return;

    const fc: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: hazardList.map((h) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [h.lng, h.lat] },
        properties: { id: h.id, type: h.type, severity: h.severity || 1 },
      })),
    };

    (m.getSource("hazards") as GeoJSONSource).setData(fc);
  }, []);

  // ── Load Hazards (cache + network) ────────────────────────────────────────
  const loadHazards = useCallback(async () => {
    // Serve from cache immediately for snappy UX
    const cached = getCache();
    if (cached && cached.length > 0) {
      setHazards(cached);
      updateHazardLayer(cached);
    }

    try {
      const res = await fetch(`${API_URL}/api/hazards`);
      if (!res.ok) throw new Error("Failed to fetch hazards");
      const data: CachedHazard[] = await res.json();
      setHazards(data);
      setCache(data);
      updateHazardLayer(data);
    } catch {
      // Offline or server down — cached data already shown
    }
  }, [getCache, setCache, updateHazardLayer]);

  useEffect(() => {
    if (isMapLoaded) loadHazards();
  }, [isMapLoaded, loadHazards]);

  // ── User Location Marker ──────────────────────────────────────────────────
  useEffect(() => {
    if (!position || !map.current || !isMapLoaded) return;

    const { lat, lng } = position;
    const lnglat: [number, number] = [lng, lat];

    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "user-location-dot";
      el.innerHTML = `
        <div class="user-location-pulse"></div>
        <div class="user-location-center"></div>
      `;
      userMarker.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(lnglat)
        .addTo(map.current);

      // Fly to user location on first GPS fix
      map.current.flyTo({ center: lnglat, zoom: 15, duration: 1500 });
    } else {
      userMarker.current.setLngLat(lnglat);
    }

    // ── Proximity check ────────────────────────────────────────────────────
    const nearbyHazard = hazards.find(
      (h) =>
        !notifiedHazardIds.current.has(h.id) &&
        haversineDistance(lat, lng, h.lat, h.lng) < PROXIMITY_WARNING_RADIUS
    );

    if (nearbyHazard) {
      notifiedHazardIds.current.add(nearbyHazard.id);
      const msg = `${
        nearbyHazard.type.charAt(0).toUpperCase() + nearbyHazard.type.slice(1)
      } reported within 300m ahead!`;
      setWarning(`⚠️ ${msg}`);
      sendNotification("RideBuddy — Hazard Nearby", msg);
    }
  }, [position, isMapLoaded, hazards, sendNotification]);

  // ── Use My Location (From field) ──────────────────────────────────────────
  const useMyLocation = () => {
    if (!position) return;
    const coords: [number, number] = [position.lng, position.lat];
    setStart(coords);
    setFromQuery(`My Location (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`);
    setFromResults([]);

    if (startMarker.current) startMarker.current.remove();
    if (map.current) {
      startMarker.current = new maplibregl.Marker({ color: "#7c3aed" })
        .setLngLat(coords)
        .addTo(map.current);
      map.current.flyTo({ center: coords, zoom: 14 });
    }
  };

  // ── Geocoding Search ──────────────────────────────────────────────────────
  const geocode = async (query: string): Promise<Place[]> => {
    if (!apiKey) return [];
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${apiKey}&limit=5`
    );
    const data = await res.json();
    return data.features || [];
  };

  const handleFromSearch = async (value: string) => {
    setFromQuery(value);
    if (value.length < 3) { setFromResults([]); return; }
    try { setFromResults(await geocode(value)); } catch { setFromResults([]); }
  };

  const handleToSearch = async (value: string) => {
    setToQuery(value);
    if (value.length < 3) { setToResults([]); return; }
    try { setToResults(await geocode(value)); } catch { setToResults([]); }
  };

  const selectFrom = (coords: [number, number], name: string) => {
    setStart(coords);
    setFromQuery(name);
    setFromResults([]);
    if (startMarker.current) startMarker.current.remove();
    if (map.current) {
      startMarker.current = new maplibregl.Marker({ color: "#7c3aed" })
        .setLngLat(coords)
        .addTo(map.current);
      map.current.flyTo({ center: coords, zoom: 14 });
    }
  };

  const selectTo = (coords: [number, number], name: string) => {
    setEnd(coords);
    setToQuery(name);
    setToResults([]);
    if (endMarker.current) endMarker.current.remove();
    if (map.current) {
      endMarker.current = new maplibregl.Marker({ color: "#ff4d6d" })
        .setLngLat(coords)
        .addTo(map.current);
      map.current.flyTo({ center: coords, zoom: 14 });
    }
  };

  // ── Get Route ─────────────────────────────────────────────────────────────
  const getRoute = async () => {
    if (!start || !end || !map.current) return;

    setIsLoadingRoute(true);
    setWarning(null);
    setRouteInfo(null);

    try {
      const res = await fetch(
        `${API_URL}/api/route?from=${start[0]},${start[1]}&to=${end[0]},${end[1]}`
      );

      if (!res.ok) throw new Error(`Route error: ${res.status}`);

      const data = await res.json();
      const mapInstance = map.current;

      // ── Clean up old route layers ──────────────────────────────────────
      const layers = mapInstance.getStyle().layers || [];
      layers.forEach((layer) => {
        if (layer.id.startsWith("route")) {
          if (mapInstance.getLayer(layer.id)) mapInstance.removeLayer(layer.id);
          if (mapInstance.getSource(layer.id)) mapInstance.removeSource(layer.id);
        }
      });

      // ── Draw alternative routes (faded) ───────────────────────────────
      data.allRoutes?.forEach((route: { geometry: LineString }, index: number) => {
        const id = `route-alt-${index}`;
        const geojson: Feature<LineString> = {
          type: "Feature",
          geometry: route.geometry,
          properties: {},
        };
        mapInstance.addSource(id, { type: "geojson", data: geojson });
        mapInstance.addLayer({
          id,
          type: "line",
          source: id,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#a855f7", "line-width": 3, "line-opacity": 0.3 },
        });
      });

      // ── Draw best route on top ─────────────────────────────────────────
      const bestGeo: Feature<LineString> = {
        type: "Feature",
        geometry: data.bestRoute.geometry as LineString,
        properties: {},
      };
      mapInstance.addSource("route-best", { type: "geojson", data: bestGeo });
      mapInstance.addLayer({
        id: "route-best",
        type: "line",
        source: "route-best",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#a855f7", "line-width": 6, "line-opacity": 1 },
      });

      // Make sure hazard markers stay on top of route
      if (mapInstance.getLayer("hazard-glow")) {
        mapInstance.moveLayer("hazard-glow");
      }
      if (mapInstance.getLayer("hazard-circles")) {
        mapInstance.moveLayer("hazard-circles");
      }

      // ── Fit map to route ───────────────────────────────────────────────
      const coords = data.bestRoute.geometry.coordinates as [number, number][];
      const bounds = coords.reduce(
        (b: maplibregl.LngLatBounds, coord) => b.extend(coord),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      mapInstance.fitBounds(bounds, { padding: 80, duration: 800 });

      // ── Route info panel ───────────────────────────────────────────────
      setRouteInfo({
        distance: data.bestRoute.distance,
        duration: data.bestRoute.duration,
        hazardCount: data.analysis?.hazardCount ?? 0,
      });

      // ── Warning for hazards on route ───────────────────────────────────
      const hCount = data.analysis?.hazardCount ?? 0;
      if (hCount > 0) {
        const breakdown = data.analysis?.typeBreakdown ?? {};
        const topType = Object.keys(breakdown).sort(
          (a, b) => breakdown[b] - breakdown[a]
        )[0];
        setWarning(
          `⚠️ ${hCount} hazard${hCount > 1 ? "s" : ""} on your route${topType ? ` (mostly ${topType})` : ""}. Drive carefully!`
        );
      }
    } catch (err) {
      console.error("[Map] Route fetch failed:", err);
      setWarning("❌ Could not fetch route. Check your connection.");
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // ── Reload hazards after new report ──────────────────────────────────────
  const handleReportSuccess = () => {
    loadHazards();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>

      {/* ── Warning Banner ─────────────────────────────────────────────── */}
      <WarningBanner message={warning} onDismiss={() => setWarning(null)} />

      {/* ── Search Panel ───────────────────────────────────────────────── */}
      <div className="search-panel" style={warning ? { top: 60 } : {}}>
        {/* FROM input */}
        <div className="search-panel__field">
          <div className="search-panel__input-row">
            <span className="search-panel__dot search-panel__dot--start" />
            <input
              id="search-from"
              type="text"
              placeholder="From: start location..."
              value={fromQuery}
              onChange={(e) => handleFromSearch(e.target.value)}
              className="search-panel__input"
              autoComplete="off"
            />
            {position && (
              <button
                className="search-panel__loc-btn"
                onClick={useMyLocation}
                title="Use my current location"
                aria-label="Use my location as start"
              >
                📍
              </button>
            )}
          </div>
          {fromResults.length > 0 && (
            <div className="search-panel__results">
              {fromResults.map((place, i) => (
                <div
                  key={i}
                  className="search-panel__result-item"
                  onClick={() => selectFrom(place.center, place.place_name)}
                >
                  {place.place_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TO input */}
        <div className="search-panel__field">
          <div className="search-panel__input-row">
            <span className="search-panel__dot search-panel__dot--end" />
            <input
              id="search-to"
              type="text"
              placeholder="To: destination..."
              value={toQuery}
              onChange={(e) => handleToSearch(e.target.value)}
              className="search-panel__input"
              autoComplete="off"
            />
          </div>
          {toResults.length > 0 && (
            <div className="search-panel__results">
              {toResults.map((place, i) => (
                <div
                  key={i}
                  className="search-panel__result-item"
                  onClick={() => selectTo(place.center, place.place_name)}
                >
                  {place.place_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Get Route button */}
        <button
          id="get-route-btn"
          onClick={getRoute}
          disabled={!start || !end || isLoadingRoute}
          className="search-panel__route-btn"
          aria-busy={isLoadingRoute}
        >
          {isLoadingRoute ? "Finding best route..." : "🗺 Get Safe Route"}
        </button>
      </div>

      {/* ── Map Container ──────────────────────────────────────────────── */}
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100vh" }}
        aria-label="Interactive road map"
        role="application"
      />

      {/* ── Route Panel ────────────────────────────────────────────────── */}
      <RoutePanel
        distance={routeInfo?.distance ?? null}
        duration={routeInfo?.duration ?? null}
        hazardCount={routeInfo?.hazardCount ?? null}
        onClose={() => setRouteInfo(null)}
      />

      {/* ── Floating Report Button ─────────────────────────────────────── */}
      <ReportButton
        onClick={() => {
          if (permission !== "granted") requestPermission();
          setIsReportOpen(true);
        }}
      />

      {/* ── Bottom Sheet (hazard report form) ─────────────────────────── */}
      <BottomSheet
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        userLat={position?.lat ?? null}
        userLng={position?.lng ?? null}
        apiUrl={API_URL}
        onSuccess={handleReportSuccess}
      />
    </div>
  );
}