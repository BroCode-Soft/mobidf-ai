"use client";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import type { RouteLeg } from "@/lib/api";

const makePin = (color: string, label: string) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);font-size:11px;font-weight:900;color:#fff;">${label}</span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

const ORIGIN_ICON = makePin("#10b981", "A");
const DEST_ICON   = makePin("#f43f5e", "B");

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

interface Props {
  origin:      { lat: number; lon: number } | null;
  destination: { lat: number; lon: number } | null;
  legs:        RouteLeg[];
  pickMode:    "origin" | "destination" | null;
  onMapClick:  (lat: number, lon: number) => void;
}

export default function RouteMap({ origin, destination, legs, pickMode, onMapClick }: Props) {
  const center: [number, number] = origin
    ? [origin.lat, origin.lon]
    : destination
    ? [destination.lat, destination.lon]
    : [-15.82, -48.00];

  const legColors = ["#818cf8", "#f59e0b", "#34d399"];

  return (
    <MapContainer
      center={center}
      zoom={origin && destination ? 11 : 10}
      style={{ width: "100%", height: "100%", cursor: pickMode ? "crosshair" : "grab" }}
      zoomControl={false}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OSM &copy; CARTO'
        maxZoom={19}
      />

      {pickMode && <ClickHandler onMapClick={onMapClick} />}

      {/* Polylines das pernas da rota */}
      {legs.map((leg, i) => (
        <Polyline
          key={i}
          positions={[
            [leg.from_lat, leg.from_lon],
            [leg.to_lat,   leg.to_lon],
          ]}
          pathOptions={{
            color: legColors[i % legColors.length],
            weight: 5,
            opacity: 0.85,
            dashArray: leg.line_tipo === "local" ? "8 6" : undefined,
          }}
        />
      ))}

      {origin && (
        <Marker position={[origin.lat, origin.lon]} icon={ORIGIN_ICON} zIndexOffset={1000} />
      )}
      {destination && (
        <Marker position={[destination.lat, destination.lon]} icon={DEST_ICON} zIndexOffset={999} />
      )}

      {/* Dica de modo de clique */}
      {pickMode && (
        <div style={{
          position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, pointerEvents: "none",
          background: pickMode === "origin" ? "rgba(16,185,129,0.9)" : "rgba(244,63,94,0.9)",
          color: "#fff", fontSize: 11, fontWeight: 700,
          padding: "6px 14px", borderRadius: 99,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          {pickMode === "origin" ? "Toque para definir origem" : "Toque para definir destino"}
        </div>
      )}
    </MapContainer>
  );
}
