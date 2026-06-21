"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  api,
  type VehiclePosition,
  type DensityCell,
  type GestoraEvent,
  type BusSuggestion,
} from "@/lib/api";
import Logo from "@/components/ui/Logo";

const FleetMap = dynamic(() => import("@/components/gestora/FleetMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", background: "#0f172a",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Carregando mapa…</div>
    </div>
  ),
});

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default function GestoraPage() {
  const isMobile = useIsMobile();

  const [vehicles, setVehicles]         = useState<VehiclePosition[]>([]);
  const [density, setDensity]           = useState<DensityCell[]>([]);
  const [events, setEvents]             = useState<GestoraEvent[]>([]);
  const [suggestions, setSuggestions]   = useState<BusSuggestion[]>([]);
  const [activeEvent, setActiveEvent]   = useState<GestoraEvent | null>(null);
  const [nearbyCount, setNearbyCount]   = useState(0);

  const [placingEvent, setPlacingEvent] = useState(false);
  const [pendingLoc, setPendingLoc]     = useState<{ lat: number; lon: number } | null>(null);
  const [eventName, setEventName]       = useState("");
  const [eventAud, setEventAud]         = useState(10000);
  const [creating, setCreating]         = useState(false);

  const [tab, setTab]         = useState<"eventos" | "onibus">("eventos");
  const [sheetOpen, setSheetOpen] = useState(false);   // mobile bottom-sheet

  const load = useCallback(async () => {
    try {
      const [v, d, ev] = await Promise.all([
        api.gestora2.vehiclesLive(),
        api.gestora2.density(),
        api.gestora2.listEvents(),
      ]);
      setVehicles(v);
      setDensity(d);
      setEvents(ev);
    } catch { /**/ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (!placingEvent) return;
    setPendingLoc({ lat, lon });
    setPlacingEvent(false);
    if (isMobile) setSheetOpen(true);
  }, [placingEvent, isMobile]);

  async function submitEvent() {
    if (!pendingLoc || !eventName.trim()) return;
    setCreating(true);
    try {
      const ev = await api.gestora2.createEvent({
        nome: eventName.trim(), lat: pendingLoc.lat, lon: pendingLoc.lon,
        audiencia_esperada: eventAud,
        raio_m: Math.round(Math.sqrt(eventAud) * 4),
      });
      setEvents(p => [...p, ev]);
      setEventName(""); setPendingLoc(null); setEventAud(10000);
    } finally { setCreating(false); }
  }

  async function loadSuggestions(ev: GestoraEvent) {
    setActiveEvent(ev); setTab("onibus");
    try {
      const r = await api.gestora2.suggest(ev.id);
      setSuggestions(r.suggestions); setNearbyCount(r.total_nearby);
    } catch { setSuggestions([]); }
  }

  async function removeEvent(id: string) {
    await api.gestora2.deleteEvent(id);
    setEvents(p => p.filter(e => e.id !== id));
    if (activeEvent?.id === id) { setActiveEvent(null); setSuggestions([]); }
  }

  const highlighted  = suggestions.map(s => s.bus_id);
  const maxDensity   = density.length ? Math.max(...density.map(d => d.count)) : 1;
  const hotZones     = density.filter(d => d.count >= maxDensity * 0.7).length;

  /* ── conteúdo do painel (reutilizado mobile/desktop) ── */
  function PanelBody() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10,
        padding: "14px 16px 32px" }}>

        {/* ── aba eventos ── */}
        {tab === "eventos" && <>
          <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 14,
            border: "1px solid rgba(99,102,241,0.2)", padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#a5b4fc", marginBottom: 10 }}>
              Adicionar evento de alta demanda
            </div>
            {!pendingLoc ? (
              <button onClick={() => { setPlacingEvent(true); if (isMobile) setSheetOpen(false); }}
                style={{ width: "100%", padding: 11, borderRadius: 10, border: "none",
                  background: placingEvent ? "#6366f1" : "rgba(99,102,241,0.2)",
                  color: placingEvent ? "#fff" : "#a5b4fc",
                  fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {placingEvent ? "🎯 Toque no mapa…" : "📍 Marcar localização no mapa"}
              </button>
            ) : <>
              <div style={{ fontSize: 10, color: "#22c55e", marginBottom: 8, fontWeight: 700 }}>
                ✓ {pendingLoc.lat.toFixed(4)}, {pendingLoc.lon.toFixed(4)}
              </div>
              <input value={eventName} onChange={e => setEventName(e.target.value)}
                placeholder="Nome do evento (ex: Jogo Brasil)"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.07)", color: "#fff",
                  fontSize: 14, marginBottom: 8, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#64748b", alignSelf: "center" }}>Público:</span>
                {[5000, 10000, 30000, 60000].map(n => (
                  <button key={n} onClick={() => setEventAud(n)} style={{
                    padding: "6px 12px", borderRadius: 6, border: "none",
                    background: eventAud === n ? "#6366f1" : "rgba(255,255,255,0.08)",
                    color: eventAud === n ? "#fff" : "#94a3b8",
                    fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {n >= 1000 ? `${n / 1000}k` : n}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={submitEvent} disabled={creating || !eventName.trim()} style={{
                  flex: 1, padding: 11, borderRadius: 8, border: "none",
                  background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: creating ? "default" : "pointer", opacity: !eventName.trim() ? 0.5 : 1 }}>
                  {creating ? "Criando…" : "Criar evento"}
                </button>
                <button onClick={() => setPendingLoc(null)} style={{ padding: "11px 16px",
                  borderRadius: 8, border: "none", background: "rgba(255,255,255,0.07)",
                  color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>✕</button>
              </div>
            </>}
          </div>

          {events.length === 0
            ? <div style={{ textAlign: "center", paddingTop: 20, color: "#475569", fontSize: 12 }}>
                Nenhum evento ativo. Marque no mapa onde haverá alta demanda.
              </div>
            : events.map(ev => (
              <motion.div key={ev.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: activeEvent?.id === ev.id
                    ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${activeEvent?.id === ev.id ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: "rgba(239,68,68,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔥</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{ev.nome}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                      {ev.audiencia_esperada.toLocaleString()} pessoas
                    </div>
                  </div>
                  <button onClick={() => removeEvent(ev.id)} style={{ background: "none", border: "none",
                    color: "#475569", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>✕</button>
                </div>
                <button onClick={() => loadSuggestions(ev)} style={{ marginTop: 10, width: "100%",
                  padding: 9, borderRadius: 8, border: "none", cursor: "pointer",
                  background: "rgba(99,102,241,0.18)", color: "#a5b4fc", fontSize: 11, fontWeight: 700 }}>
                  Ver sugestões de redirecionamento →
                </button>
              </motion.div>
            ))
          }
        </>}

        {/* ── aba ônibus ── */}
        {tab === "onibus" && <>
          {activeEvent ? <>
            <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.2)", padding: "12px 14px", marginBottom: 4 }}>
              <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700, marginBottom: 2 }}>
                EVENTO ATIVO
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{activeEvent.nome}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                {nearbyCount} ônibus já próximos · {suggestions.length} para redirecionar
              </div>
            </div>
            {suggestions.length === 0
              ? <div style={{ textAlign: "center", paddingTop: 20, color: "#475569", fontSize: 12 }}>
                  Nenhum ônibus disponível para redirecionamento.
                </div>
              : suggestions.map((s, i) => (
                <motion.div key={s.bus_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{ background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: "rgba(251,191,36,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚌</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24" }}>{s.bus_id}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>Linha {s.linha}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#22c55e" }}>
                        {s.tempo_chegada_min} min
                      </div>
                      <div style={{ fontSize: 9, color: "#64748b" }}>{s.dist_event_km} km</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, padding: "7px 11px", borderRadius: 7,
                    background: "rgba(99,102,241,0.12)", fontSize: 11, color: "#a5b4fc", fontWeight: 600 }}>
                    → {s.acao}
                  </div>
                </motion.div>
              ))
            }
          </> : <div style={{ textAlign: "center", paddingTop: 40, color: "#475569" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚌</div>
            <div style={{ fontSize: 12 }}>
              Selecione um evento para ver<br />sugestões de redirecionamento.
            </div>
          </div>}
        </>}
      </div>
    );
  }

  /* ── tabs ── */
  function Tabs() {
    return (
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0 }}>
        {(["eventos", "onibus"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "12px 0", border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
            background: "transparent",
            color: tab === t ? "#6366f1" : "#64748b",
            borderBottom: `2px solid ${tab === t ? "#6366f1" : "transparent"}`,
            transition: "all 0.15s" }}>
            {t === "eventos" ? "🔥 Eventos" : "🚌 Ônibus"}
          </button>
        ))}
      </div>
    );
  }

  /* ── kpis ── */
  function KpiRow() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6,
        padding: "10px 16px", flexShrink: 0 }}>
        {[
          { label: "Ônibus", value: vehicles.length.toLocaleString(), color: "#6366f1" },
          { label: "Zonas", value: hotZones, color: "#ef4444" },
          { label: "Eventos", value: events.length, color: "#f59e0b" },
          { label: "Suggest.", value: suggestions.length, color: "#22c55e" },
        ].map(k => (
          <div key={k.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10,
            padding: "7px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 9, color: "#475569", fontWeight: 600, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>
    );
  }

  /* ════════════════════════════════
     MOBILE  (mapa fixo + bottom sheet)
  ════════════════════════════════ */
  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0a0f1e",
        fontFamily: "system-ui,sans-serif" }}>

        {/* mapa ocupa tela toda */}
        <div style={{ position: "absolute", inset: 0 }}>
          <FleetMap vehicles={vehicles} density={density} events={events}
            onMapClick={handleMapClick} placingEvent={placingEvent}
            highlightedBuses={highlighted} />
        </div>

        {/* header flutuante */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 400,
          background: "linear-gradient(180deg,rgba(10,15,30,0.92) 0%,transparent 100%)",
          padding: "14px 16px 24px",
          display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ flexShrink: 0 }}>
            <Logo variant="mark" height={32} />
          </a>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 900, color: "#fff",
            textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
            Controle de Frota
          </div>
          {vehicles.length > 0 && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
              {vehicles.length.toLocaleString()} ôn.
            </div>
          )}
        </div>

        {/* hint de posicionamento */}
        {placingEvent && (
          <div style={{ position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)", zIndex: 500,
            background: "#6366f1", color: "#fff",
            padding: "12px 22px", borderRadius: 99, fontSize: 14, fontWeight: 700,
            boxShadow: "0 4px 24px rgba(99,102,241,0.6)", pointerEvents: "none",
            whiteSpace: "nowrap" }}>
            🎯 Toque no mapa para marcar
          </div>
        )}

        {/* legenda flutuante esquerda */}
        {!sheetOpen && (
          <div style={{ position: "absolute", bottom: 100, left: 12, zIndex: 300,
            background: "rgba(15,23,42,0.88)", borderRadius: 10,
            padding: "8px 12px", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)" }}>
            {[["#22c55e","Baixa"],["#f59e0b","Média"],["#ef4444","Alta"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>{l}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── bottom sheet ── */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 300,
          display: "flex", flexDirection: "column" }}>

          {/* alça + KPIs — sempre visível */}
          <button onClick={() => setSheetOpen(v => !v)}
            style={{ background: "#0f172a", border: "none", cursor: "pointer",
              borderRadius: "18px 18px 0 0",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              padding: "8px 0 0", width: "100%" }}>
            {/* drag handle */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
              <div style={{ width: 40, height: 4, borderRadius: 99,
                background: "rgba(255,255,255,0.2)" }} />
            </div>
            <KpiRow />
            <div style={{ padding: "4px 16px 10px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>
                {sheetOpen ? "▼ Fechar painel" : "▲ Ver eventos e ônibus"}
              </span>
            </div>
          </button>

          {/* conteúdo expansível */}
          <AnimatePresence initial={false}>
            {sheetOpen && (
              <motion.div
                key="sheet-body"
                initial={{ height: 0 }}
                animate={{ height: "58dvh" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.32, ease }}
                style={{ background: "#0f172a", overflow: "hidden",
                  display: "flex", flexDirection: "column" }}>
                <Tabs />
                <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
                  <PanelBody />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FAB eventos (quando sheet fechado) */}
        {!sheetOpen && !placingEvent && (
          <button onClick={() => { setTab("eventos"); setSheetOpen(true); }}
            style={{ position: "absolute", bottom: 104, right: 16, zIndex: 400,
              width: 52, height: 52, borderRadius: "50%", border: "none",
              background: "linear-gradient(135deg,#6366f1,#818cf8)",
              color: "#fff", fontSize: 20, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(99,102,241,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            🔥
          </button>
        )}
      </div>
    );
  }

  /* ════════════════════════════════
     DESKTOP  (sidebar + mapa)
  ════════════════════════════════ */
  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden",
      background: "#0a0f1e", fontFamily: "system-ui,sans-serif" }}>

      {/* sidebar */}
      <div style={{ width: 340, flexShrink: 0, background: "#0f172a",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ padding: "20px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <a href="/" style={{ display: "block", marginBottom: 10 }}>
            <Logo variant="full" height={26} />
          </a>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>Controle de Frota</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {vehicles.length > 0
              ? `${vehicles.length.toLocaleString()} ônibus · ${events.length} eventos`
              : "Carregando dados..."}
          </div>
        </div>

        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <KpiRow />
        </div>
        <Tabs />

        <div style={{ flex: 1, overflowY: "auto" }}>
          <PanelBody />
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[["#22c55e","Baixa densidade"],["#f59e0b","Média"],["#ef4444","Alta"],
            ["#6366f1","Ônibus"],["#fbbf24","Redirecionar"]].map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
              <span style={{ fontSize: 9, color: "#64748b", fontWeight: 600 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* mapa */}
      <div style={{ flex: 1, position: "relative" }}>
        {placingEvent && (
          <div style={{ position: "absolute", top: 16, left: "50%",
            transform: "translateX(-50%)", zIndex: 1000,
            background: "#6366f1", color: "#fff",
            padding: "10px 20px", borderRadius: 99, fontSize: 13, fontWeight: 700,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
            🎯 Clique no mapa para marcar o evento
          </div>
        )}
        <FleetMap vehicles={vehicles} density={density} events={events}
          onMapClick={handleMapClick} placingEvent={placingEvent}
          highlightedBuses={highlighted} />
      </div>
    </div>
  );
}
