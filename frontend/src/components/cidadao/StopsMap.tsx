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
// Tronco compartilhado: Asa Norte → Asa Sul → Guará → Taguatinga → Centro Met
// Coordenadas reais do Metrô-DF (OSM relation 420554/420556)
// Tronco: Terminal Asa Norte → Central → Asa Sul → Shopping → Guará → Arniqueiras → Águas Claras
const METRO_SPINE: [number, number][] = [
  [-15.7628, -47.8840], // Terminal Asa Norte (aprox.)
  [-15.7677, -47.8856], // 113 Norte
  [-15.7725, -47.8866], // 111 Norte
  [-15.7773, -47.8871], // 109 Norte
  [-15.7820, -47.8875], // 107 Norte
  [-15.7851, -47.8879], // 105 Norte
  [-15.7932, -47.8847], // Central
  [-15.7995, -47.8861], // Galeria
  [-15.8057, -47.8894], // 102 Sul
  [-15.8150, -47.8987], // 106 Sul
  [-15.8189, -47.9040], // 108 Sul
  [-15.8228, -47.9094], // 110 Sul
  [-15.8267, -47.9148], // 112 Sul
  [-15.8306, -47.9201], // 114 Sul
  [-15.8371, -47.9326], // Terminal Asa Sul
  [-15.8324, -47.9507], // Shopping
  [-15.8230, -47.9750], // Feira
  [-15.8267, -47.9834], // Guará
  [-15.8367, -48.0171], // Arniqueiras
  [-15.8400, -48.0283], // Águas Claras (bifurcação)
];
// Ramal Verde (Ceilândia): Águas Claras → Concessionárias → ... → Ceilândia
const METRO_CEILANDIA: [number, number][] = [
  [-15.8400, -48.0283], // Águas Claras
  [-15.8351, -48.0386], // Concessionárias
  [-15.8324, -48.0453], // Estrada Parque
  [-15.8333, -48.0563], // Praça do Relógio
  [-15.8354, -48.0862], // Centro Metropolitano
  [-15.8377, -48.1033], // Ceilândia Sul
  [-15.8306, -48.1073], // Guariroba
  [-15.8223, -48.1119], // Ceilândia Centro
  [-15.8149, -48.1161], // Ceilândia Norte
  [-15.8056, -48.1213], // Ceilândia (terminal)
];
// Ramal Laranja (Samambaia): Águas Claras → Taguatinga Sul → ... → Samambaia
const METRO_SAMAMBAIA: [number, number][] = [
  [-15.8400, -48.0283], // Águas Claras
  [-15.8518, -48.0419], // Taguatinga Sul
  [-15.8649, -48.0598], // Furnas
  [-15.8690, -48.0716], // Samambaia Sul
  [-15.8736, -48.0849], // Samambaia (terminal)
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
