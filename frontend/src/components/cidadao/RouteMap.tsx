"use client";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from "react-leaflet";
import type { RouteLeg, POI } from "@/lib/api";

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

const makePOIIcon = (emoji: string, color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};border:2.5px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;
      font-size:15px;">
      ${emoji}
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });

const ORIGIN_ICON = makePin("#10b981", "A");
const DEST_ICON   = makePin("#f43f5e", "B");

const POI_STYLE: Record<string, { emoji: string; color: string }> = {
  feira:        { emoji: "🛒", color: "#f59e0b" },
  hospital:     { emoji: "🏥", color: "#f43f5e" },
  ubs:          { emoji: "🏥", color: "#fb923c" },
  escola:       { emoji: "🏫", color: "#6366f1" },
  universidade: { emoji: "🎓", color: "#7c3aed" },
  shopping:     { emoji: "🏬", color: "#a855f7" },
  parque:       { emoji: "🌳", color: "#22c55e" },
  farmacia:     { emoji: "💊", color: "#10b981" },
  banco:        { emoji: "🏦", color: "#3b82f6" },
  restaurante:  { emoji: "🍽️", color: "#f97316" },
  posto:        { emoji: "⛽", color: "#64748b" },
  supermercado: { emoji: "🛒", color: "#eab308" },
  padaria:      { emoji: "🥖", color: "#b45309" },
  academia:     { emoji: "💪", color: "#8b5cf6" },
  biblioteca:   { emoji: "📚", color: "#0ea5e9" },
  museu:        { emoji: "🏛️", color: "#d97706" },
  teatro:       { emoji: "🎭", color: "#ec4899" },
  cinema:       { emoji: "🎬", color: "#8b5cf6" },
  delegacia:    { emoji: "👮", color: "#1d4ed8" },
  correio:      { emoji: "📮", color: "#fbbf24" },
  rodoviaria:   { emoji: "🚌", color: "#7c3aed" },
  aeroporto:    { emoji: "✈️", color: "#0ea5e9" },
  hotel:        { emoji: "🏨", color: "#14b8a6" },
  igrejas:      { emoji: "⛪", color: "#94a3b8" },
  local:        { emoji: "📍", color: "#94a3b8" },
};

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

interface Props {
  origin:      { lat: number; lon: number } | null;
  destination: { lat: number; lon: number } | null;
  legs:        RouteLeg[];
  pois:        POI[];
  pickMode:    "origin" | "destination" | null;
  onMapClick:  (lat: number, lon: number) => void;
  onPoiSelect: (poi: POI, as: "origin" | "destination") => void;
}

export default function RouteMap({
  origin, destination, legs, pois, pickMode, onMapClick, onPoiSelect,
}: Props) {
  const center: [number, number] = origin
    ? [origin.lat, origin.lon]
    : destination
    ? [destination.lat, destination.lon]
    : [-15.82, -48.00];

  const legColors = ["#818cf8", "#f59e0b", "#34d399"];

  return (
    <MapContainer
      center={center}
      zoom={pois.length > 0 ? 11 : origin && destination ? 11 : 10}
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

      {/* POIs */}
      {pois.map((poi) => {
        const style = POI_STYLE[poi.type] ?? POI_STYLE.local;
        const icon  = makePOIIcon(style.emoji, style.color);
        return (
          <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={icon} zIndexOffset={500}>
            <Popup>
              <div style={{ minWidth: 160, fontFamily: "system-ui, sans-serif" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                  {style.emoji} {poi.name}
                </div>
                {poi.address && (
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{poi.address}</div>
                )}
                {poi.opening && (
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>🕐 {poi.opening}</div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onPoiSelect(poi, "origin")}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none",
                      background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    Partir daqui
                  </button>
                  <button onClick={() => onPoiSelect(poi, "destination")}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none",
                      background: "#f43f5e", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    Ir aqui
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

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
