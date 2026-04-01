"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  Map as MapLibreMap,
  GeoJSONSource,
} from "maplibre-gl";
import type { Feature, LineString } from "geojson";

type Place = {
  place_name: string;
  center: [number, number];
};

export default function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);

  const [start, setStart] = useState<[number, number] | null>(null);
  const [end, setEnd] = useState<[number, number] | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  // 🚀 Init Map
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

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [apiKey]);

  // 🔍 Search (MapTiler)
  const handleSearch = async (value: string) => {
    setQuery(value);

    if (value.length < 3 || !apiKey) {
      setResults([]);
      return;
    }

    const res = await fetch(
      `https://api.maptiler.com/geocoding/${value}.json?key=${apiKey}`
    );
    const data = await res.json();
    setResults(data.features);
  };

  // 📍 Select point
  const selectLocation = (coords: [number, number]) => {
    if (!map.current) return;

    map.current.flyTo({ center: coords, zoom: 15 });

    new maplibregl.Marker({
      color: start ? "#ff4d6d" : "#7c3aed", // purple start, pink end
    })
      .setLngLat(coords)
      .addTo(map.current);

    if (!start) setStart(coords);
    else setEnd(coords);

    setQuery("");
    setResults([]);
  };

  // 🛣️ Get Route (YOUR BACKEND)
const getRoute = async () => {
  if (!start || !end || !map.current) return;

  const res = await fetch(
    `http://localhost:5000/api/route?from=${start[0]},${start[1]}&to=${end[0]},${end[1]}`
  );

  const data = await res.json();
  console.log(data);

  const mapInstance = map.current;

  // 🔥 CLEANUP OLD ROUTES
  const layers = mapInstance.getStyle().layers || [];

  layers.forEach((layer) => {
    if (layer.id.startsWith("route")) {
      if (mapInstance.getLayer(layer.id)) mapInstance.removeLayer(layer.id);
      if (mapInstance.getSource(layer.id)) mapInstance.removeSource(layer.id);
    }
  });

  // 🔥 DRAW ALL ROUTES (FADED)
  data.allRoutes?.forEach((route: any, index: number) => {
    const id = `route-alt-${index}`;

    const geojson: Feature<LineString> = {
      type: "Feature",
      geometry: route.geometry as LineString,
      properties: {},
    };

    mapInstance.addSource(id, {
      type: "geojson",
      data: geojson,
    });

    mapInstance.addLayer({
      id,
      type: "line",
      source: id,
      paint: {
        "line-color": "#a855f7",
        "line-width": 3,
        "line-opacity": 1,
      },
    });
  });

  // 🔥 DRAW BEST ROUTE ON TOP (IMPORTANT)
  const bestGeo: Feature<LineString> = {
    type: "Feature",
    geometry: data.bestRoute.geometry as LineString,
    properties: {},
  };

  mapInstance.addSource("route-best", {
    type: "geojson",
    data: bestGeo,
  });

  mapInstance.addLayer({
    id: "route-best",
    type: "line",
    source: "route-best",
    paint: {
      "line-color": "#a855f7", // purple
      "line-width": 6,
    },
  });

  // 🔥 FIT MAP TO ROUTE (nice UX)
  const coords = data.bestRoute.geometry.coordinates;

  const bounds = coords.reduce(
    (b: maplibregl.LngLatBounds, coord: [number, number]) =>
      b.extend(coord),
    new maplibregl.LngLatBounds(coords[0], coords[0])
  );

  mapInstance.fitBounds(bounds, {
    padding: 50,
    duration: 800,
  });

  // 🧠 Debug
  console.log("Analysis:", data.analysis);
};

  return (
    <div style={{ position: "relative" }}>
      {/* 🔍 Search UI */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 10,
          background: "#111827",
          color: "white",
          padding: "12px",
          borderRadius: "12px",
          width: "280px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
        }}
      >
        <input
          type="text"
          placeholder="Search places..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "6px",
            border: "none",
            marginBottom: "8px",
          }}
        />

        {results.map((place, i) => (
          <div
            key={i}
            style={{
              padding: "6px",
              cursor: "pointer",
              borderBottom: "1px solid #333",
            }}
            onClick={() => selectLocation(place.center)}
          >
            {place.place_name}
          </div>
        ))}

        <button
          onClick={getRoute}
          style={{
            marginTop: "10px",
            width: "100%",
            padding: "10px",
            background: "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
          }}
        >
          Get Route
        </button>
      </div>

      {/* 🗺️ Map */}
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100vh" }}
      />
    </div>
  );
}