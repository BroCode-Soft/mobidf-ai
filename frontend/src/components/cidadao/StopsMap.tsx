"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import type { Stop, MetroLineSegment } from "@/lib/api";

/* ── Metrô-DF — polylines da rota oficial ─────────────────────────────────
   Espinha dorsal: Terminal Asa Norte → Asa Norte → Central → Asa Sul
                   → Terminal Asa Sul → Guará → Taguatinga → Centro Metropolitano
   Ramal Ceilândia (verde, M1): Centro Met. → Guariroba → Ceilândia Norte
   Ramal Samambaia (laranja, M2): Centro Met. → Taguatinga Sul → Furnas → Samambaia
── */
const METRO_SPINE: [number, number][] = [
  [-15.7476, -47.8800], // Terminal Asa Norte
  [-15.7553, -47.8852], // 115 Norte
  [-15.7620, -47.8873], // 113 Norte
  [-15.7688, -47.8889], // 111 Norte
  [-15.7756, -47.8900], // 109 Norte
  [-15.7824, -47.8908], // 107 Norte
  [-15.7862, -47.8918], // 105 Norte
  [-15.7880, -47.8928], // 103 Norte
  [-15.7893, -47.8958], // C. Norte
  [-15.7944, -47.8923], // Central
  [-15.7988, -47.8924], // Galeria
  [-15.8028, -47.8930], // C. Sul / Sarah
  [-15.8078, -47.8935], // Asa Sul
  [-15.8122, -47.8940], // 102 Sul
  [-15.8166, -47.8945], // 104 Sul
  [-15.8210, -47.8950], // 106 Sul
  [-15.8254, -47.8957], // 108 Sul
  [-15.8298, -47.8963], // 110 Sul
  [-15.8342, -47.8968], // 112 Sul
  [-15.8372, -47.9010], // 114 Sul
  [-15.8390, -47.9110], // 116 Sul
  [-15.8400, -47.9220], // Terminal Asa Sul
  [-15.8313, -47.9315], // Shopping
  [-15.8290, -47.9484], // Guará
  [-15.8258, -47.9728], // Arniqueiras
  [-15.8218, -47.9886], // Concessionárias
  [-15.8196, -48.0005], // Estrada Parque
  [-15.8360, -48.0256], // Águas Claras
  [-15.8278, -48.0393], // Onyama
  [-15.8192, -48.0583], // Praça do Relógio
  [-15.8140, -48.0438], // Centro Metropolitano (bifurcação)
];
// Ramal Ceilândia (verde M1) — noroeste
const METRO_CEILANDIA: [number, number][] = [
  [-15.8140, -48.0438], // Centro Metropolitano
  [-15.8256, -48.0718], // Guariroba
  [-15.8357, -48.1028], // Ceilândia Sul
  [-15.8265, -48.1118], // Ceilândia Centro
  [-15.8090, -48.1137], // Ceilândia Norte
];
// Ramal Samambaia (laranja M2) — sul
const METRO_SAMAMBAIA: [number, number][] = [
  [-15.8140, -48.0438], // Centro Metropolitano
  [-15.8248, -48.0495], // Taguatinga Sul
  [-15.8430, -48.0594], // Furnas
  [-15.8548, -48.0726], // Samambaia Sul
  [-15.8650, -48.0889], // Samambaia
];

/* ── Ícone de estação de metrô (diamante colorido) ── */
function createMetroIcon(cor: string, isSelected: boolean, ativo = true) {
  const size = isSelected ? 20 : 16;
  const bg   = ativo ? cor : "#64748b";
  const bdr  = ativo
    ? `${isSelected ? 3 : 2}px solid #fff`
    : "2px dashed #94a3b8";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${bg};
      transform:rotate(45deg);
      border:${bdr};
      border-radius:3px;
      opacity:${ativo ? 1 : 0.55};
      box-shadow:0 2px 8px rgba(0,0,0,0.5),0 0 0 2px ${bg}55;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
}

/* ── Ícone de localização do usuário ── */
const USER_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:18px;height:18px;
    background:#6366f1;
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 0 0 4px rgba(99,102,241,0.3),0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
});

/* ── Controller de viewport ── */
function MapController({
  allStops,
  focusStops,
  selectedStop,
  userLoc,
}: {
  allStops: Stop[];
  focusStops: Stop[];
  selectedStop: Stop | null;
  userLoc: { lat: number; lon: number } | null;
}) {
  const map = useMap();
  const prevSelId = useRef<string | null>(null);
  const prevFocusLen = useRef(0);

  useEffect(() => {
    const selChanged = selectedStop?.stop_id !== prevSelId.current;
    const focusChanged = focusStops.length !== prevFocusLen.current;

    if (selectedStop && selChanged) {
      prevSelId.current = selectedStop.stop_id;
      map.setView([selectedStop.stop_lat, selectedStop.stop_lon], 16, { animate: true });
      return;
    }
    if (focusChanged && focusStops.length > 0) {
      prevFocusLen.current = focusStops.length;
      try {
        map.fitBounds(
          focusStops.map((s) => [s.stop_lat, s.stop_lon] as [number, number]),
          { padding: [32, 32], maxZoom: 15, animate: true },
        );
      } catch { /**/ }
      return;
    }
    if (!selectedStop && focusStops.length === 0 && userLoc) {
      map.setView([userLoc.lat, userLoc.lon], 14, { animate: true });
    }
  }, [selectedStop, focusStops, userLoc, map]);

  return null;
}

/* ── Componente principal ── */
interface Props {
  allStops: Stop[];       // todas as paradas carregadas (bus + metro)
  focusStops: Stop[];     // paradas de busca/GPS (destacadas)
  selectedStop: Stop | null;
  userLoc: { lat: number; lon: number } | null;
  onSelectStop: (stop: Stop) => void;
  metroLines?: MetroLineSegment[];  // geometria real do WFS (opcional — fallback hardcoded)
}

export default function StopsMap({
  allStops,
  focusStops,
  selectedStop,
  userLoc,
  onSelectStop,
  metroLines,
}: Props) {
  const center: [number, number] = userLoc
    ? [userLoc.lat, userLoc.lon]
    : [-15.82, -48.00]; // centro aproximado do DF
  const zoom = userLoc ? 13 : 10;

  const focusIds = new Set(focusStops.map((s) => s.stop_id));
  const hasFocus = focusStops.length > 0;

  const fmtDist = (m?: number) =>
    !m ? "" : m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />

      <MapController
        allStops={allStops}
        focusStops={focusStops}
        selectedStop={selectedStop}
        userLoc={userLoc}
      />

      {/* ── Polylines do Metrô — WFS real ou fallback hardcoded ── */}
      {metroLines && metroLines.length > 0
        ? metroLines.map((seg, i) => (
            <Polyline
              key={i}
              positions={seg.coords as [number, number][]}
              pathOptions={{ color: seg.cor, weight: 4, opacity: 0.9 }}
            />
          ))
        : <>
            <Polyline positions={METRO_SPINE}     pathOptions={{ color:"#22c55e", weight:4, opacity:0.9 }} />
            <Polyline positions={METRO_CEILANDIA} pathOptions={{ color:"#22c55e", weight:4, opacity:0.9 }} />
            <Polyline positions={METRO_SAMAMBAIA} pathOptions={{ color:"#f97316", weight:4, opacity:0.9 }} />
          </>
      }

      {/* ── Localização do usuário ── */}
      {userLoc && (
        <Marker position={[userLoc.lat, userLoc.lon]} icon={USER_ICON}>
          <Popup>
            <span style={{ fontWeight: 700, fontSize: 12 }}>Você está aqui</span>
          </Popup>
        </Marker>
      )}

      {/* ── Todas as paradas (bus) — fundo, pequenas ── */}
      {allStops
        .filter((s) => s.type !== "metro")
        .map((stop) => {
          const isFocused  = focusIds.has(stop.stop_id);
          const isSelected = stop.stop_id === selectedStop?.stop_id;
          const dimmed     = hasFocus && !isFocused && !isSelected;

          return (
            <CircleMarker
              key={stop.stop_id}
              center={[stop.stop_lat, stop.stop_lon]}
              radius={isSelected ? 10 : isFocused ? 7 : 4}
              pathOptions={{
                color:       isSelected ? "#c4b5fd" : isFocused ? "#818cf8" : "#6366f1",
                fillColor:   isSelected ? "#7c3aed" : isFocused ? "#6366f1" : "#818cf8",
                fillOpacity: dimmed ? 0.25 : isSelected ? 1 : 0.85,
                weight:      isSelected ? 3 : 1.5,
                opacity:     dimmed ? 0.35 : 1,
              }}
              eventHandlers={{ click: () => onSelectStop(stop) }}
            >
              {(isFocused || isSelected) && (
                <Popup>
                  <div style={{ minWidth: 148, fontFamily: "system-ui, sans-serif" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                      {stop.stop_name}
                    </div>
                    {stop.dist_m !== undefined && (
                      <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, marginBottom: 8 }}>
                        📍 A {fmtDist(stop.dist_m)} de você
                      </div>
                    )}
                    <button
                      onClick={() => onSelectStop(stop)}
                      style={{
                        width: "100%", padding: "7px 0", borderRadius: 8, border: "none",
                        background: "linear-gradient(135deg,#7c3aed,#6366f1)",
                        color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700,
                      }}
                    >
                      Ver horários →
                    </button>
                  </div>
                </Popup>
              )}
            </CircleMarker>
          );
        })}

      {/* ── Estações de Metrô — sempre visíveis, em cima ── */}
      {allStops
        .filter((s) => s.type === "metro")
        .map((station) => {
          const isSelected = station.stop_id === selectedStop?.stop_id;
          const cor   = station.cor_metro ?? "#22c55e";
          const ativo = station.ativo !== false;  // undefined → true
          return (
            <Marker
              key={station.stop_id}
              position={[station.stop_lat, station.stop_lon]}
              icon={createMetroIcon(cor, isSelected, ativo)}
              eventHandlers={{ click: () => onSelectStop(station) }}
              zIndexOffset={1000}
            >
              <Popup>
                <div style={{ minWidth: 160, fontFamily: "system-ui, sans-serif" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{
                      width: 10, height: 10, background: cor,
                      transform: "rotate(45deg)", borderRadius: 2, flexShrink: 0,
                    }} />
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                      {station.stop_name}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>
                    {station.linha_metro?.includes("samambaia") && !station.linha_metro?.includes("ceilandia")
                      ? "Linha Samambaia (M2)"
                      : station.linha_metro?.includes("ceilandia") && station.linha_metro?.includes("samambaia")
                      ? "M1 Ceilândia + M2 Samambaia"
                      : "Linha Ceilândia (M1)"}
                  </div>
                  {station.ativo === false && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#f97316",
                      background: "#fff7ed", borderRadius: 4, padding: "2px 6px",
                      marginBottom: 6, display: "inline-block" }}>
                      🚧 Em construção / inativa
                    </div>
                  )}
                  {station.freq_pico && station.ativo !== false && (
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>
                      Pico: a cada {station.freq_pico} min · Normal: a cada {station.freq_normal} min
                    </div>
                  )}
                  {station.dist_m !== undefined && (
                    <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, marginBottom: 8 }}>
                      🚇 A {fmtDist(station.dist_m)} de você
                    </div>
                  )}
                  {ativo ? (
                    <button
                      onClick={() => onSelectStop(station)}
                      style={{
                        width: "100%", padding: "7px 0", borderRadius: 8, border: "none",
                        background: `linear-gradient(135deg,${cor},${cor}cc)`,
                        color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700,
                      }}
                    >
                      Ver próximos trens →
                    </button>
                  ) : (
                    <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
                      Estação não operacional no momento
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* ── Legenda ── */}
      <div
        style={{
          position: "absolute", bottom: 28, right: 8, zIndex: 1000,
          background: "rgba(15,12,41,0.88)", backdropFilter: "blur(8px)",
          borderRadius: 10, padding: "7px 10px",
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", flexDirection: "column", gap: 4,
          pointerEvents: "none",
        }}
      >
        {[
          { color: "#22c55e", shape: "diamond", label: "M1 — Linha Ceilândia" },
          { color: "#f97316", shape: "diamond", label: "M2 — Linha Samambaia" },
          { color: "#6366f1", shape: "circle",  label: "Parada de ônibus" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {item.shape === "diamond" ? (
              <div style={{
                width: 8, height: 8, background: item.color,
                transform: "rotate(45deg)", borderRadius: 1, flexShrink: 0,
              }} />
            ) : (
              <div style={{
                width: 8, height: 8, background: item.color,
                borderRadius: "50%", flexShrink: 0,
              }} />
            )}
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </MapContainer>
  );
}
