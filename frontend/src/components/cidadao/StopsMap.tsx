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

/* ── Metrô-DF — geometria real (OSM way 94975101 + relation 420554/420556) ──
   Tronco: Asa Norte → Central → Asa Sul → Shopping → Feira → Guará
           → Arniqueiras → Águas Claras (bifurcação)
   Verde (M1 Ceilândia):  Águas Claras → Concessionárias → ... → Ceilândia
   Laranja (M2 Samambaia): Águas Claras → Taguatinga Sul → ... → Samambaia
── */

// Tronco: aprox. Asa Norte + 53 pontos exatos do trilho OSM (way 94975101)
//         + posições reais das estações Asa Sul → Águas Claras
const METRO_SPINE: [number, number][] = [
  // ── Asa Norte (interpolado — OSM "Asa Norte" node -15.76280,-47.88395) ──
  [-15.76280, -47.88400],
  [-15.77025, -47.88411],
  [-15.77770, -47.88423],
  [-15.78514, -47.88434],
  // ── Geometria exata do way OSM 94975101 (Central → perto de Terminal Asa Sul) ──
  [-15.79259, -47.88445],
  [-15.79323, -47.88467],
  [-15.79370, -47.88482],
  [-15.79448, -47.88508],
  [-15.79522, -47.88533],
  [-15.79611, -47.88565],
  [-15.79629, -47.88569],
  [-15.79658, -47.88569],
  [-15.79692, -47.88563],
  [-15.79729, -47.88555],
  [-15.79768, -47.88557],
  [-15.79800, -47.88562],
  [-15.79841, -47.88575],
  [-15.79879, -47.88587],
  [-15.79947, -47.88610],
  [-15.80004, -47.88630],
  [-15.80085, -47.88656],
  [-15.80173, -47.88686],
  [-15.80235, -47.88709],
  [-15.80321, -47.88752],
  [-15.80362, -47.88776],
  [-15.80410, -47.88811],
  [-15.80496, -47.88880],
  [-15.80571, -47.88947],
  [-15.80683, -47.89041],
  [-15.80747, -47.89096],
  [-15.80810, -47.89152],
  [-15.80883, -47.89217],
  [-15.81006, -47.89336],
  [-15.81050, -47.89378],
  [-15.81110, -47.89438],
  [-15.81171, -47.89500],
  [-15.81274, -47.89608],
  [-15.81344, -47.89687],
  [-15.81420, -47.89776],
  [-15.81496, -47.89868],
  [-15.81576, -47.89974],
  [-15.81599, -47.90003],
  [-15.81603, -47.90008],
  [-15.81894, -47.90403],
  [-15.82161, -47.90772],
  [-15.82281, -47.90938],
  [-15.82387, -47.91084],
  [-15.82454, -47.91177],
  [-15.82669, -47.91475],
  [-15.83059, -47.92014],
  [-15.83141, -47.92128],
  [-15.83356, -47.92408],
  [-15.83381, -47.92446],
  [-15.83408, -47.92488],
  [-15.83436, -47.92538],
  [-15.83472, -47.92616],
  [-15.83587, -47.92920],
  // ── Posições exatas das estações OSM (relation 420554) ──
  [-15.83705, -47.93263], // Asa Sul (Terminal)
  [-15.83240, -47.95067], // Shopping
  [-15.82302, -47.97503], // Feira
  [-15.82666, -47.98340], // Guará
  [-15.83671, -48.01706], // Arniqueiras
  [-15.84000, -48.02826], // Águas Claras (bifurcação)
];

// Verde (Linha 1 Ceilândia) — posições exatas das estações OSM
const METRO_CEILANDIA: [number, number][] = [
  [-15.84000, -48.02826], // Águas Claras
  [-15.83514, -48.03862], // Concessionárias
  [-15.83236, -48.04528], // Estrada Parque
  [-15.83326, -48.05634], // Praça do Relógio
  [-15.83542, -48.08616], // Centro Metropolitano
  [-15.83774, -48.10325], // Ceilândia Sul
  [-15.83059, -48.10725], // Guariroba
  [-15.82226, -48.11189], // Ceilândia Centro
  [-15.81485, -48.11609], // Ceilândia Norte
  [-15.80555, -48.12127], // Ceilândia (terminal)
];

// Laranja (Linha 2 Samambaia) — posições exatas das estações OSM
const METRO_SAMAMBAIA: [number, number][] = [
  [-15.84000, -48.02826], // Águas Claras
  [-15.85179, -48.04191], // Taguatinga Sul
  [-15.86490, -48.05983], // Furnas
  [-15.86899, -48.07158], // Samambaia Sul
  [-15.87364, -48.08493], // Samambaia (terminal)
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
