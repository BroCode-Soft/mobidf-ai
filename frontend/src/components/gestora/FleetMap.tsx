"use client";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents, Popup } from "react-leaflet";
import type { VehiclePosition, DensityCell, GestoraEvent } from "@/lib/api";

interface Props {
  vehicles: VehiclePosition[];
  density: DensityCell[];
  events: GestoraEvent[];
  onMapClick?: (lat: number, lon: number) => void;
  placingEvent: boolean;
  highlightedBuses?: string[];
}

function ClickHandler({ onMapClick, active }: { onMapClick?: (lat: number, lon: number) => void; active: boolean }) {
  useMapEvents({
    click(e) {
      if (active && onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function PulsingEventMarker({ event }: { event: GestoraEvent }) {
  const animRef = useRef<SVGCircleElement>(null);
  return (
    <CircleMarker
      center={[event.lat, event.lon]}
      radius={18}
      pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.18, weight: 2, dashArray: "6 4" }}
    >
      <Tooltip permanent direction="top" offset={[0, -20]}>
        <span style={{ fontWeight: 800, fontSize: 11 }}>🔥 {event.nome}</span>
        <br />
        <span style={{ fontSize: 10, color: "#666" }}>{event.audiencia_esperada.toLocaleString()} pessoas</span>
      </Tooltip>
    </CircleMarker>
  );
}

const MAX_DENSITY = 8;

function densityColor(count: number): string {
  const t = Math.min(count / MAX_DENSITY, 1);
  if (t < 0.33) return "#22c55e";
  if (t < 0.66) return "#f59e0b";
  return "#ef4444";
}

export default function FleetMap({
  vehicles, density, events, onMapClick, placingEvent, highlightedBuses = [],
}: Props) {
  return (
    <MapContainer
      center={[-15.7942, -47.8825]}
      zoom={11}
      style={{ width: "100%", height: "100%", cursor: placingEvent ? "crosshair" : "grab" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
      />

      <ClickHandler onMapClick={onMapClick} active={placingEvent} />

      {/* Density heatmap cells */}
      {density.map((cell, i) => (
        <CircleMarker
          key={`d-${i}`}
          center={[cell.lat, cell.lon]}
          radius={Math.max(8, cell.count * 5)}
          pathOptions={{
            color: "transparent",
            fillColor: densityColor(cell.count),
            fillOpacity: 0.28,
          }}
        />
      ))}

      {/* Bus positions */}
      {vehicles.map((v) => {
        const isHighlighted = highlightedBuses.includes(v.bus_id);
        return (
          <CircleMarker
            key={v.bus_id}
            center={[v.lat, v.lon]}
            radius={isHighlighted ? 7 : 3}
            pathOptions={{
              color: isHighlighted ? "#fbbf24" : "#6366f1",
              fillColor: isHighlighted ? "#fbbf24" : "#818cf8",
              fillOpacity: isHighlighted ? 1 : 0.75,
              weight: isHighlighted ? 2 : 0.5,
            }}
          >
            {isHighlighted && (
              <Tooltip direction="top" offset={[0, -8]}>
                <span style={{ fontSize: 11 }}>
                  🚌 {v.bus_id} · Linha {v.linha}
                  <br />
                  {v.velocidade.toFixed(0)} km/h
                </span>
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}

      {/* Event hotspots */}
      {events.map((ev) => (
        <PulsingEventMarker key={ev.id} event={ev} />
      ))}
    </MapContainer>
  );
}
