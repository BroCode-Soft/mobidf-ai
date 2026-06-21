"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { api, type Stop, type NextTrip, type CartaoSaldo, type MetroLineSegment } from "@/lib/api";
import Logo from "@/components/ui/Logo";

/* Leaflet precisa de window — importado apenas no client */
const StopsMap = dynamic(() => import("@/components/cidadao/StopsMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center",
      justifyContent:"center", background:"rgba(255,255,255,0.04)", borderRadius:18 }}>
      <div style={{ color:"rgba(255,255,255,0.35)", fontSize:12 }}>Carregando mapa…</div>
    </div>
  ),
});

// TIPO_BADGE estendido para metrô
const METRO_COLORS: Record<string, string> = {
  ceilandia:            "#22c55e",
  samambaia:            "#f97316",
  "ceilandia,samambaia":"#22c55e",
};

const ease: [number,number,number,number] = [0.16, 1, 0.3, 1];
type Tab = "linhas" | "cartao" | "maria";

/* ── Cores por ocupação ── */
const OCC_GRAD: Record<string, string> = {
  vazio:    "linear-gradient(90deg,#10b981,#34d399)",
  moderado: "linear-gradient(90deg,#f59e0b,#fbbf24)",
  lotado:   "linear-gradient(90deg,#f43f5e,#fb7185)",
};
const OCC_COLOR:  Record<string, string> = { vazio:"#34d399", moderado:"#fbbf24", lotado:"#fb7185" };
const OCC_BG:     Record<string, string> = {
  vazio:"rgba(16,185,129,0.15)", moderado:"rgba(245,158,11,0.15)", lotado:"rgba(244,63,94,0.15)"
};
const OCC_LABEL:  Record<string, string> = { vazio:"Disponível", moderado:"Moderado", lotado:"Lotado" };
const TIPO_BADGE: Record<string, { label:string; color:string }> = {
  troncal:     { label:"Troncal",     color:"rgba(99,102,241,0.2)"  },
  expressa:    { label:"Expressa",    color:"rgba(245,158,11,0.2)"  },
  alimentadora:{ label:"Alimentadora",color:"rgba(16,185,129,0.15)" },
  brt:         { label:"BRT",         color:"rgba(139,92,246,0.25)" },
  diametral:   { label:"★ Diametral", color:"rgba(251,191,36,0.2)"  },
  local:       { label:"Local",       color:"rgba(100,116,139,0.2)" },
};

function OccPill({ level }: { level: string }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 9px",
      borderRadius:99, fontSize:10, fontWeight:700, background:OCC_BG[level], color:OCC_COLOR[level] }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:OCC_COLOR[level] }} />
      {OCC_LABEL[level] ?? level}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo?: string }) {
  if (!tipo || tipo === "troncal") return null;
  const b = TIPO_BADGE[tipo];
  if (!b) return null;
  return (
    <span style={{ padding:"2px 7px", borderRadius:99, fontSize:9, fontWeight:700,
      background:b.color, color:"rgba(255,255,255,0.85)" }}>
      {b.label}
    </span>
  );
}

/* ── Predição de conforto (substitui reserva) ── */
function ComfortBadge({ pct }: { pct: number }) {
  const levels = [
    { max:40,  icon:"🪑", label:"Vai sentado",            bg:"#dcfce7", color:"#15803d" },
    { max:65,  icon:"🪑", label:"Provavelmente sentado",  bg:"#f0fdf4", color:"#16a34a" },
    { max:80,  icon:"🧍", label:"Provavelmente em pé",    bg:"#fff7ed", color:"#c2410c" },
    { max:101, icon:"😰", label:"Muito cheio",            bg:"#fef2f2", color:"#dc2626" },
  ];
  const l = levels.find(x => pct < x.max) ?? levels[3];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4,
      padding:"5px 11px", borderRadius:99, fontSize:10, fontWeight:800,
      background: l.bg, color: l.color, flexShrink:0 }}>
      {l.icon} {l.label}
    </span>
  );
}

/* ── Card de ônibus / metrô ── */
function BusCard({ trip }: { trip: NextTrip }) {
  const isMetro  = trip.tipo === "metro";
  const metroCor = trip.cor_metro ?? "#f59e0b";
  const pct      = trip.ocupacao_pct ?? 0;
  const grad     = isMetro
    ? `linear-gradient(90deg,${metroCor},${metroCor}99)`
    : (OCC_GRAD[trip.nivel_ocupacao] ?? OCC_GRAD.vazio);
  const eta      = trip.minutos_para_chegada ?? 0;
  const etaColor = eta <= 3 ? "#f43f5e" : eta <= 8 ? "#f59e0b" : isMetro ? metroCor : "#7c3aed";
  const borderColor = isMetro ? metroCor : trip.recomendado ? "#7c3aed" : "transparent";

  return (
    <motion.div layout
      initial={{ opacity:0, y:14, scale:0.97 }}
      animate={{ opacity:1, y:0, scale:1 }}
      exit={{ opacity:0, y:-10, scale:0.97 }}
      transition={{ duration:0.3, ease }}
      style={{ background:"#fff", borderRadius:20, padding:"16px 18px",
        boxShadow: `0 0 0 2px ${borderColor}, 0 4px 20px rgba(0,0,0,0.09)`,
        position:"relative", overflow:"hidden" }}>

      {/* Badge recomendado / metrô */}
      {isMetro && (
        <div style={{ position:"absolute", top:0, left:0,
          background:`linear-gradient(135deg,${metroCor},${metroCor}bb)`,
          color:"#fff", fontSize:9, fontWeight:800, padding:"4px 14px 4px 12px",
          borderBottomRightRadius:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          Metrô-DF
        </div>
      )}
      {!isMetro && trip.recomendado && (
        <div style={{ position:"absolute", top:0, right:0,
          background:"linear-gradient(135deg,#7c3aed,#6366f1)",
          color:"#fff", fontSize:9, fontWeight:800, padding:"4px 12px 4px 14px",
          borderBottomLeftRadius:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          Recomendado
        </div>
      )}

      <div style={{ display:"flex", alignItems:"flex-start", gap:12,
        marginBottom:10, marginTop: isMetro ? 14 : 0 }}>
        <div style={{ width:46, height:46, borderRadius:14, flexShrink:0,
          background: isMetro
            ? `linear-gradient(135deg,${metroCor},${metroCor}cc)`
            : trip.tipo === "diametral" ? "linear-gradient(135deg,#f59e0b,#fbbf24)"
            : trip.tipo === "brt"       ? "linear-gradient(135deg,#7c3aed,#6366f1)"
            : trip.tipo === "expressa"  ? "linear-gradient(135deg,#f43f5e,#fb7185)"
            : "linear-gradient(135deg,#6366f1,#818cf8)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
          {isMetro ? "🚇" : trip.tipo === "brt" ? "🚎" : trip.tipo === "diametral" ? "⚡" : "🚌"}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:3 }}>
            <span style={{ fontSize:15, fontWeight:900, color:"#0f172a" }}>{trip.linha}</span>
            {!isMetro && <OccPill level={trip.nivel_ocupacao} />}
            {!isMetro && <TipoBadge tipo={trip.tipo} />}
            {isMetro && (
              <span style={{ fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:99,
                background:`${metroCor}22`, color: metroCor, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                {trip.linha_metro?.includes("samambaia") && !trip.linha_metro?.includes("ceilandia")
                  ? "Linha Samambaia" : "Linha Ceilândia"}
                {trip.linha_metro?.includes(",") && " · M1+M2"}
              </span>
            )}
          </div>
          <div style={{ fontSize:11, color:"#475569" }}>{trip.descricao ?? trip.destino}</div>
          {isMetro && trip.freq_min && (
            <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>
              Frequência: a cada {trip.freq_min} min · Sentido: {trip.destino}
            </div>
          )}
        </div>

        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:26, fontWeight:900, color:etaColor, lineHeight:1 }}>{eta}</div>
          <div style={{ fontSize:9, color:"#94a3b8", fontWeight:700, letterSpacing:"0.06em" }}>MIN</div>
        </div>
      </div>

      <div style={{ height:4, background:"#f1f5f9", borderRadius:99, overflow:"hidden", marginBottom:10 }}>
        <div style={{ height:"100%", width:`${pct}%`, background:grad, borderRadius:99,
          transition:"width 0.5s ease" }} />
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ fontSize:11, color:"#94a3b8", display:"flex", flexDirection:"column", gap:1 }}>
          <span>🕐 {trip.departure_time}{!isMetro && ` · ${pct}% ocupado`}</span>
          {trip.fonte && (
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase",
              color: isMetro ? metroCor : trip.fonte === "tempo_real" ? "#34d399" : "#94a3b8" }}>
              {isMetro ? "📋 Horário oficial Metrô-DF"
               : trip.fonte === "tempo_real" ? "📡 GPS tempo real"
               : trip.fonte === "gtfs_oficial" ? "📅 Horário oficial DFTRANS"
               : trip.fonte}
              {!isMetro && trip.posicao_gps && ` · ônibus a ${trip.posicao_gps.distancia_m < 1000
                ? `${trip.posicao_gps.distancia_m}m` : `${(trip.posicao_gps.distancia_m/1000).toFixed(1)}km`}`}
            </span>
          )}
        </div>
        <ComfortBadge pct={pct} />
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   PAGE
══════════════════════════════════════════ */
export default function CidadaoPage() {
  const [tab, setTab]             = useState<Tab>("linhas");
  const [query, setQuery]         = useState("");
  const [allStops, setAllStops]   = useState<Stop[]>([]);       // todas as paradas (mapa)
  const [metroLines, setMetroLines] = useState<MetroLineSegment[]>([]);
  const [stops, setStops]         = useState<Stop[]>([]);       // resultados de busca/GPS (destaque)
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [trips, setTrips]         = useState<NextTrip[]>([]);
  const [loading, setLoading]     = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError]   = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [userLoc, setUserLoc]     = useState<{ lat: number; lon: number } | null>(null);
  const [cartaoNum, setCartaoNum] = useState("");
  const [cartaoData, setCartaoData] = useState<CartaoSaldo | null>(null);
  const [cartaoLoading, setCartaoLoading] = useState(false);
  const [cartaoError, setCartaoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // O mapa é sempre visível na aba Linhas (carrega todas as paradas no mount)
  const showMap = tab === "linhas";

  /* ── Busca por texto ── */
  const searchStops = useCallback(async (q: string) => {
    if (!q.trim()) { setStops([]); return; }
    setLoading(true); setError(null);
    try { setStops(await api.cidadao.searchStops(q)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro ao buscar"); }
    finally { setLoading(false); }
  }, []);

  /* ── GPS ── */
  const locateMe = useCallback(() => {
    if (!navigator.geolocation) { setGpsError("GPS não disponível."); return; }
    setGpsLoading(true); setGpsError(null); setQuery(""); setSelectedStop(null); setTrips([]);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setUserLoc({ lat, lon });
        try {
          const nearby = await api.cidadao.nearbyStops(lat, lon, 5000);
          setStops(nearby);
          if (nearby.length > 0) {
            const nearest = nearby[0];
            setSelectedStop(nearest);
            setTrips(await api.cidadao.nextTrips(nearest.stop_id));
          }
        } catch (e: unknown) {
          setGpsError(e instanceof Error ? e.message : "Erro ao buscar paradas próximas");
        } finally { setGpsLoading(false); }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsError("Permissão de localização negada.");
        else if (err.code === 2) setGpsError("Localização indisponível. Busque manualmente.");
        else setGpsError("Timeout de GPS.");
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }, []);

  /* ── Seleciona parada (via lista ou mapa) ── */
  const selectStop = useCallback(async (s: Stop) => {
    setSelectedStop(s);
    setLoading(true);
    // NÃO limpa stops — o mapa mantém os pins visíveis
    try { setTrips(await api.cidadao.nextTrips(s.stop_id)); }
    catch { setTrips([]); }
    finally { setLoading(false); }
  }, []);

  /* ── Cartão ── */
  async function consultarCartao() {
    const digits = cartaoNum.replace(/\D/g, "");
    if (digits.length < 4) { setCartaoError("Informe pelo menos 4 dígitos."); return; }
    setCartaoLoading(true); setCartaoError(null); setCartaoData(null);
    try { setCartaoData(await api.cidadao.cartaoSaldo(digits)); }
    catch (e: unknown) { setCartaoError(e instanceof Error ? e.message : "Erro"); }
    finally { setCartaoLoading(false); }
  }

  // Carrega paradas + geometria das linhas ao montar
  useEffect(() => {
    api.cidadao.allStopsMap()
      .then(setAllStops)
      .catch(() => api.cidadao.metroStations().then(setAllStops).catch(() => {}));
    // Geometria WFS das linhas (real mode) — em mock mode retorna [] → usa fallback hardcoded
    api.cidadao.metroLines().then(setMetroLines).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchStops(query), 350);
    return () => clearTimeout(t);
  }, [query, searchStops]);

  const TABS: Array<{ id: Tab; icon: string; label: string }> = [
    { id:"linhas",   icon:"🚌", label:"Linhas"   },
    { id:"cartao",   icon:"💳", label:"Cartão"   },
    { id:"maria",    icon:"🌟", label:"Maria"    },
  ];

  const fmtDist = (m?: number) => !m ? "" : m < 1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(1)}km`;

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0f0c29,#302b63,#24243e)",
      paddingBottom:80, position:"relative" }}>

      {/* Glow */}
      <div style={{ position:"fixed", top:"-15%", left:"50%", transform:"translateX(-50%)", width:500,
        height:380, borderRadius:"50%", pointerEvents:"none", zIndex:0,
        background:"radial-gradient(ellipse,rgba(99,102,241,0.22),transparent 70%)" }} />

      {/* ── Header ── */}
      <motion.header initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.45, ease }}
        style={{ padding:"20px 18px 0", position:"relative", zIndex:10 }}>

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
          <Logo variant="full" height={30} />
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5,
            padding:"4px 10px", borderRadius:99,
            background:"rgba(16,185,129,0.15)", border:"1px solid rgba(16,185,129,0.25)" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#10b981",
              boxShadow:"0 0 6px #10b981", animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:10, color:"#34d399", fontWeight:600 }}>Ao vivo</span>
          </div>
        </div>

        {/* Search + GPS — só na aba Linhas */}
        {tab === "linhas" && (
          <div style={{ display:"flex", gap:8, marginBottom:4 }}>
            <div style={{ flex:1, position:"relative" }}>
              <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)",
                fontSize:16, pointerEvents:"none" }}>🔍</span>
              <input ref={inputRef}
                style={{ width:"100%", padding:"13px 14px 13px 40px", borderRadius:16, border:"none",
                  background:"rgba(255,255,255,0.12)", color:"#fff", fontSize:14, outline:"none",
                  backdropFilter:"blur(8px)", boxSizing:"border-box" }}
                placeholder="Buscar parada — ex: ceilandia, rodoviaria…"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setSelectedStop(null);
                  setTrips([]);
                }}
              />
            </div>
            <button onClick={locateMe} disabled={gpsLoading} title="Usar minha localização"
              style={{ width:48, height:48, borderRadius:14, border:"none", cursor:"pointer",
                flexShrink:0, transition:"all 0.15s", fontSize:20,
                background: gpsLoading ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.3)",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: gpsLoading ? "none" : "0 0 12px rgba(99,102,241,0.3)" }}>
              {gpsLoading
                ? <div style={{ width:18, height:18, border:"2.5px solid rgba(255,255,255,0.3)",
                    borderTopColor:"#c4b5fd", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
                : "🎯"}
            </button>
          </div>
        )}
      </motion.header>

      {/* ── Mapa — aparece quando há paradas ou localização GPS ── */}
      <AnimatePresence>
        {showMap && (
          <motion.div
            key="map"
            initial={{ opacity:0, height:0 }}
            animate={{ opacity:1, height:420 }}
            exit={{ opacity:0, height:0 }}
            transition={{ duration:0.38, ease }}
            style={{ margin:"10px 18px 0", borderRadius:20, overflow:"hidden",
              border:"1px solid rgba(255,255,255,0.12)", position:"relative", zIndex:5 }}>

            <StopsMap
              allStops={allStops}
              focusStops={stops}
              selectedStop={selectedStop}
              userLoc={userLoc}
              onSelectStop={selectStop}
              metroLines={metroLines}
            />

            {/* Contador de paradas no canto */}
            {allStops.length > 0 && (
              <div style={{ position:"absolute", bottom:10, left:10, zIndex:1000,
                background:"rgba(15,12,41,0.85)", backdropFilter:"blur(8px)",
                borderRadius:99, padding:"4px 11px",
                border:"1px solid rgba(255,255,255,0.12)",
                fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.7)", pointerEvents:"none" }}>
                {allStops.filter(s => s.type !== "metro").length} paradas ·{" "}
                {allStops.filter(s => s.type === "metro").length} estações de metrô
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Conteúdo ── */}
      <main style={{ padding:"14px 18px", position:"relative", zIndex:5 }}>

        {(error || gpsError) && (
          <div style={{ marginBottom:12, padding:"11px 15px", borderRadius:14, fontSize:12,
            background:"rgba(244,63,94,0.15)", border:"1px solid rgba(244,63,94,0.25)", color:"#fb7185" }}>
            {gpsError ?? error}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
            transition={{ duration:0.22, ease }}>

            {/* ══ LINHAS ══ */}
            {tab === "linhas" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

                {/* Lista de paradas (quando nenhuma selecionada) */}
                {!selectedStop && stops.length > 0 && (
                  <>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontWeight:700,
                      letterSpacing:"0.06em", textTransform:"uppercase" }}>
                      {stops.length} parada{stops.length !== 1 ? "s" : ""} encontrada{stops.length !== 1 ? "s" : ""}
                      {query && ` para "${query}"`} · clique para ver horários
                    </div>
                    <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:18,
                      border:"1px solid rgba(255,255,255,0.12)", overflow:"hidden",
                      backdropFilter:"blur(12px)" }}>
                      {stops.map((s, i) => (
                        <button key={s.stop_id} onClick={() => selectStop(s)}
                          style={{ display:"block", width:"100%", padding:"13px 16px",
                            textAlign:"left", background:"none", border:"none", cursor:"pointer",
                            borderBottom: i < stops.length-1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:"#fff",
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {s.stop_name}
                              </div>
                              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:1 }}>📍 DF</div>
                            </div>
                            {s.dist_m !== undefined && (
                              <span style={{ fontSize:11, fontWeight:700, color:"#a78bfa", flexShrink:0,
                                background:"rgba(139,92,246,0.15)", padding:"3px 9px", borderRadius:99 }}>
                                {fmtDist(s.dist_m)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Estado idle */}
                {!selectedStop && stops.length === 0 && !loading && !gpsLoading && (
                  <div style={{ textAlign:"center", paddingTop:16 }}>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", lineHeight:1.8 }}>
                      Toque em qualquer parada 🟣 ou estação ◆ no mapa<br />
                      Busque por nome acima <span style={{ opacity:0.6 }}>(sem acento funciona)</span><br />
                      ou toque em 🎯 para usar sua localização
                    </div>
                  </div>
                )}

                {(loading || gpsLoading) && !selectedStop && (
                  <div style={{ textAlign:"center", paddingTop:32, color:"rgba(255,255,255,0.4)", fontSize:13 }}>
                    {gpsLoading ? "Obtendo localização GPS…" : "Buscando paradas…"}
                  </div>
                )}

                {/* Parada selecionada + horários */}
                {selectedStop && (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px",
                      borderRadius:14, background:"rgba(255,255,255,0.08)",
                      border:"1px solid rgba(255,255,255,0.12)" }}>
                      <span style={{ fontSize:16 }}>📍</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#fff",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {selectedStop.stop_name}
                        </div>
                        {selectedStop.dist_m !== undefined && (
                          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:1 }}>
                            A {fmtDist(selectedStop.dist_m)} de você
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setSelectedStop(null); setTrips([]); setQuery(""); setStops([]); setUserLoc(null); }}
                        style={{ background:"rgba(255,255,255,0.1)", border:"none",
                          color:"rgba(255,255,255,0.6)", borderRadius:8,
                          padding:"4px 10px", fontSize:13, cursor:"pointer" }}>×</button>
                    </div>

                    {stops.length > 1 && (
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontWeight:600,
                        letterSpacing:"0.05em", textTransform:"uppercase" }}>
                        ↑ {stops.length - 1} outra{stops.length > 2 ? "s" : ""} parada{stops.length > 2 ? "s" : ""} no mapa
                      </div>
                    )}

                    {loading && (
                      <div style={{ textAlign:"center", padding:"28px 0",
                        color:"rgba(255,255,255,0.4)", fontSize:13 }}>
                        Carregando horários…
                      </div>
                    )}

                    {!loading && trips.length > 0 && (
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontWeight:600,
                        letterSpacing:"0.06em", textTransform:"uppercase", marginTop:2 }}>
                        {trips.length} linha{trips.length !== 1 ? "s" : ""} passando nesta parada
                      </div>
                    )}

                    <AnimatePresence>
                      {trips.map(t => (
                        <BusCard key={t.trip_id} trip={t} />
                      ))}
                    </AnimatePresence>

                    {!loading && trips.length === 0 && (
                      <div style={{ textAlign:"center", padding:"32px 0",
                        color:"rgba(255,255,255,0.4)", fontSize:13 }}>
                        Nenhum horário disponível para esta parada.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ══ CARTÃO MOBILIDADE ══ */}
            {tab === "cartao" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ fontSize:17, fontWeight:800, color:"#fff", marginBottom:2 }}>
                  Cartão Mobilidade DF
                </div>

                <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:20,
                  border:"1px solid rgba(255,255,255,0.12)", padding:"20px 18px",
                  backdropFilter:"blur(12px)" }}>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontWeight:700,
                    textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>
                    Número do cartão
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input
                      style={{ flex:1, padding:"12px 14px", borderRadius:12,
                        border:"1px solid rgba(255,255,255,0.15)",
                        background:"rgba(255,255,255,0.1)", color:"#fff",
                        fontSize:16, outline:"none", letterSpacing:"0.15em", fontWeight:600 }}
                      placeholder="0000 0000 0000 0000"
                      value={cartaoNum}
                      maxLength={19}
                      inputMode="numeric"
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g,"").slice(0,16);
                        setCartaoNum(raw.replace(/(\d{4})(?=\d)/g,"$1 ").trim());
                        setCartaoData(null); setCartaoError(null);
                      }}
                      onKeyDown={e => e.key === "Enter" && consultarCartao()}
                    />
                    <button onClick={consultarCartao} disabled={cartaoLoading}
                      style={{ padding:"0 20px", borderRadius:12, border:"none", cursor:"pointer",
                        background:"linear-gradient(135deg,#7c3aed,#6366f1)", color:"#fff",
                        fontWeight:700, fontSize:13, flexShrink:0, opacity: cartaoLoading ? 0.6 : 1 }}>
                      {cartaoLoading ? "…" : "Consultar"}
                    </button>
                  </div>
                  {cartaoError && (
                    <div style={{ marginTop:10, fontSize:12, color:"#fb7185" }}>{cartaoError}</div>
                  )}
                  <div style={{ marginTop:10, fontSize:10, color:"rgba(255,255,255,0.3)", lineHeight:1.5 }}>
                    Demonstração · Saldo real em cartaomobilidade.df.gov.br
                  </div>
                </div>

                <AnimatePresence>
                  {cartaoData && (
                    <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
                      exit={{ opacity:0 }} transition={{ duration:0.3, ease }}>
                      <div style={{ background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(99,102,241,0.4))",
                        border:"1px solid rgba(139,92,246,0.4)", borderRadius:20, padding:"22px 20px",
                        backdropFilter:"blur(12px)", marginBottom:10 }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>Saldo disponível</div>
                        <div style={{ fontSize:40, fontWeight:900, color:"#fff", letterSpacing:"-0.03em", lineHeight:1 }}>
                          R$ {cartaoData.saldo.toFixed(2).replace(".",",")}
                        </div>
                        <div style={{ marginTop:14, display:"flex", gap:16, flexWrap:"wrap" }}>
                          {[
                            { l:"Cartão", v: cartaoData.numero },
                            { l:"Validade", v: cartaoData.validade },
                            { l:"Status", v: cartaoData.status },
                          ].map(s => (
                            <div key={s.l}>
                              <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontWeight:700,
                                textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.l}</div>
                              <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", fontWeight:700, marginTop:1 }}>
                                {s.v}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:18,
                        border:"1px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
                        <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.7)" }}>
                            Últimas viagens
                          </div>
                        </div>
                        {cartaoData.ultimas_viagens.map((v, i) => (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                            borderBottom: i < cartaoData.ultimas_viagens.length-1
                              ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                              background:"rgba(99,102,241,0.15)",
                              display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🚌</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>{v.linha}</div>
                              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:1 }}>{v.descricao}</div>
                            </div>
                            <div style={{ textAlign:"right", flexShrink:0 }}>
                              <div style={{ fontSize:13, fontWeight:800,
                                color: v.valor < 0 ? "#fb7185" : "#34d399" }}>
                                R$ {Math.abs(v.valor).toFixed(2).replace(".",",")}
                              </div>
                              <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:1 }}>{v.data}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", textAlign:"center",
                        marginTop:10, lineHeight:1.6 }}>
                        {cartaoData.nota}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!cartaoData && !cartaoLoading && (
                  <div style={{ textAlign:"center", paddingTop:24 }}>
                    <div style={{ fontSize:44, marginBottom:12 }}>💳</div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)", lineHeight:1.6 }}>
                      Digite o número do seu Cartão Mobilidade<br />para consultar o saldo
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ MARIA ══ */}
            {tab === "maria" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(124,58,237,0.2))",
                  border:"1px solid rgba(139,92,246,0.3)", borderRadius:22, padding:22,
                  backdropFilter:"blur(12px)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                    <div style={{ width:50, height:50, borderRadius:18, fontSize:22,
                      background:"linear-gradient(135deg,#7c3aed,#6366f1)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>🌟</div>
                    <div>
                      <div style={{ fontSize:17, fontWeight:900, color:"#fff" }}>Cenário Maria</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)" }}>Ceilândia → SIA · Impacto real</div>
                    </div>
                  </div>
                  <p style={{ fontSize:13, color:"rgba(255,255,255,0.65)", lineHeight:1.7, margin:0 }}>
                    Maria, 34 anos, gasta <strong style={{ color:"#fff" }}>4h/dia</strong> em ônibus com 2 baldeações.
                    A rota diametral Ceilândia→SIA reduziria para <strong style={{ color:"#34d399" }}>3h25</strong>,
                    devolvendo <strong style={{ color:"#a78bfa" }}>+12,8h/mês</strong> de vida.
                  </p>
                </div>

                {[
                  { icon:"⏱", label:"Tempo atual / dia",      value:"~4h",      sub:"2 baldeações na Rodoviária", color:"#fb7185" },
                  { icon:"⚡", label:"Com rota diametral",    value:"3h25",     sub:"0 baldeações — direto ao SIA",color:"#34d399" },
                  { icon:"📅", label:"Horas devolvidas / mês",value:"+12,8h",   sub:"Tempo com a família",         color:"#a78bfa" },
                  { icon:"💵", label:"Economia de passagem",  value:"R$ 90/mês",sub:"Uma baldeação eliminada",     color:"#fbbf24" },
                ].map((s, i) => (
                  <motion.div key={s.label}
                    initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.07 }}
                    style={{ background:"#fff", borderRadius:18, padding:"16px 18px",
                      boxShadow:"0 2px 12px rgba(0,0,0,0.07)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ width:44, height:44, borderRadius:13, flexShrink:0,
                        background:`${s.color}18`, border:`1px solid ${s.color}30`,
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                        {s.icon}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>{s.label}</div>
                        <div style={{ fontSize:24, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
                        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{s.sub}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, display:"flex",
        background:"rgba(15,12,41,0.92)", backdropFilter:"blur(16px)",
        borderTop:"1px solid rgba(255,255,255,0.08)", padding:"6px 8px 8px", zIndex:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3,
              padding:"8px 4px", borderRadius:13, border:"none", cursor:"pointer", transition:"all 0.15s",
              background: tab === t.id ? "rgba(139,92,246,0.18)" : "transparent",
              color: tab === t.id ? "#c4b5fd" : "rgba(255,255,255,0.35)" }}>
            <span style={{ fontSize:19 }}>{t.icon}</span>
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>
              {t.label}
            </span>
          </button>
        ))}
      </nav>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        input::placeholder { color: rgba(255,255,255,0.35); }
        .leaflet-container { background: #1e1b4b; }
        .leaflet-popup-content-wrapper { border-radius: 12px !important; }
        .leaflet-popup-tip { display: none; }
      `}</style>
    </div>
  );
}
