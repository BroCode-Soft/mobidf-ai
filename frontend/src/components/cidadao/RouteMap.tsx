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
  restaurante:"🍽️",lanchonete:"🍔",cafe:"☕",padaria:"🥖",acougue:"🥩",
  hortifruti:"🥦",sorvete:"🍦",doces:"🍬",bar:"🍺",balada:"🎵",bebidas:"🥤",
  supermercado:"🛒",mercadinho:"🏪",feira:"🛒",
  hospital:"🏥",ubs:"🏥",farmacia:"💊",dentista:"🦷",veterinario:"🐾",otica:"👓",
  escola:"🏫",creche:"🧒",universidade:"🎓",
  banco:"🏦",caixa_eletronico:"💳",
  delegacia:"👮",bombeiros:"🚒",correio:"📮",tribunal:"⚖️",orgao_publico:"🏛️",
  embaixada:"🏳️",biblioteca:"📚",
  rodoviaria:"🚌",aeroporto:"✈️",posto:"⛽",lava_jato:"🚿",mecanica:"🔧",
  concessionaria:"🚗",autopecas:"🔩",bicicletaria:"🚲",estacionamento:"🅿️",
  parque:"🌳",academia:"💪",esportes:"⚽",estadio:"🏟️",piscina:"🏊",playground:"🛝",
  teatro:"🎭",cinema:"🎬",museu:"🏛️",galeria:"🖼️",atracoes:"🎠",mirador:"🔭",
  cultura:"🎨",cassino:"🎰",hotel:"🏨",
  salao:"💇",barbearia:"✂️",spa:"🧖",tatuagem:"🖋️",
  shopping:"🏬",roupas:"👕",calcados:"👟",eletronicos:"📱",celulares:"📱",
  informatica:"💻",ferragens:"🔨",moveis:"🛋️",floricultura:"💐",petshop:"🐶",
  livraria:"📖",joalheria:"💍",presentes:"🎁",brinquedos:"🧸",papelaria:"📝",
  lavanderia:"👕",agencia_viagem:"🌍",
  igrejas:"⛪",comercio:"🏪",recarga_ev:"⚡",local:"📍",
} as unknown as Record<string, { emoji: string; color: string }>;

const POI_COLORS: Record<string, string> = {
  restaurante:"#f97316",lanchonete:"#fb923c",cafe:"#92400e",padaria:"#b45309",
  acougue:"#dc2626",hortifruti:"#16a34a",sorvete:"#ec4899",doces:"#e879f9",bar:"#f59e0b",
  balada:"#a21caf",bebidas:"#0284c7",supermercado:"#eab308",mercadinho:"#ca8a04",
  feira:"#f59e0b",hospital:"#f43f5e",ubs:"#fb923c",farmacia:"#10b981",
  dentista:"#06b6d4",veterinario:"#84cc16",otica:"#6366f1",escola:"#6366f1",
  creche:"#818cf8",universidade:"#7c3aed",banco:"#3b82f6",caixa_eletronico:"#2563eb",
  delegacia:"#1d4ed8",bombeiros:"#ef4444",correio:"#fbbf24",orgao_publico:"#64748b",
  biblioteca:"#0ea5e9",rodoviaria:"#7c3aed",aeroporto:"#0ea5e9",posto:"#64748b",
  lava_jato:"#38bdf8",mecanica:"#78716c",parque:"#22c55e",academia:"#8b5cf6",
  esportes:"#10b981",estadio:"#0d9488",piscina:"#38bdf8",teatro:"#ec4899",
  cinema:"#8b5cf6",museu:"#d97706",hotel:"#14b8a6",salao:"#f9a8d4",
  barbearia:"#94a3b8",spa:"#f0abfc",shopping:"#a855f7",roupas:"#c084fc",
  calcados:"#818cf8",eletronicos:"#38bdf8",informatica:"#3b82f6",ferragens:"#92400e",
  moveis:"#78716c",floricultura:"#f472b6",petshop:"#84cc16",livraria:"#6366f1",
  joalheria:"#fbbf24",igrejas:"#94a3b8",comercio:"#94a3b8",local:"#94a3b8",
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
        const emoji = (POI_STYLE[poi.type] as unknown as string) ?? "📍";
        const color = POI_COLORS[poi.type] ?? "#94a3b8";
        const style = { emoji, color };
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
