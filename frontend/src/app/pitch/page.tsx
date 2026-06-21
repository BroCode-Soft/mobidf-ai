"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/ui/Logo";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ODS = [
  { num: "11", color: "#f59e0b", icon: "🏙️", title: "Cidades Sustentáveis",
    desc: "Menos km ociosos, frota redistribuída por demanda real." },
  { num: "10", color: "#6366f1", icon: "⚖️", title: "Redução das Desigualdades",
    desc: "Quem mora em Ceilândia tem a mesma informação em tempo real que qualquer um." },
  { num: "13", color: "#22c55e", icon: "🌱", title: "Ação Climática",
    desc: "Corte de sobreposições = menos ônibus vazios rodando = menos carbono." },
  { num: "3",  color: "#ec4899", icon: "❤️", title: "Saúde e Bem-Estar",
    desc: "Maria recupera 35 min/dia — 12,8 h/mês de vida devolvida." },
  { num: "8",  color: "#f97316", icon: "💼", title: "Trabalho Decente",
    desc: "Economia reinvestida em Wi-Fi e ar condicionado na frota." },
  { num: "9",  color: "#0ea5e9", icon: "🔬", title: "Inovação e Infraestrutura",
    desc: "Dados públicos reais da SEMOB transformados em decisão inteligente." },
];

const PROBLEMS = [
  { icon: "🧭", title: "Cidadão no escuro", desc: "Sem saber onde o ônibus está, a espera parece infinita." },
  { icon: "🪑", title: "Vai sentado ou em pé?", desc: "Nenhum sistema previa a experiência antes de embarcar." },
  { icon: "🔁", title: "Sobreposição de linhas", desc: "Duas rotas duplicam 78% do trajeto. Dinheiro público desperdiçado." },
  { icon: "⏱️", title: "Baldeação na Rodoviária", desc: "Maria espera 18 min toda manhã. 2 baldeações. 120 min de viagem." },
  { icon: "📅", title: "Sincronização zero", desc: "Alimentadora chega, troncal já saiu. Espera extra de 15 minutos." },
  { icon: "🔥", title: "Eventos = caos", desc: "Jogo do Brasil. Sem plano. Ônibus espalhados onde não tem demanda." },
  { icon: "📊", title: "Frota às cegas", desc: "Gestoras não tinham mapa de calor de demanda em tempo real." },
  { icon: "🗺️", title: "Metrô isolado do ônibus", desc: "Apps separados. 29 estações e 6.687 paradas sem integração." },
];

const SOLUTIONS = [
  { tag: "Cidadão", color: "#6366f1", icon: "📍", title: "GPS ao vivo",
    desc: "3.312 ônibus rastreados em tempo real via WFS SEMOB. Sabe exatamente quando chegar ao ponto." },
  { tag: "Cidadão", color: "#6366f1", icon: "🪑", title: "Predição de conforto",
    desc: "Vai sentado ou em pé — baseado na ocupação real do ônibus antes de embarcar." },
  { tag: "Cidadão", color: "#6366f1", icon: "🗺️", title: "Mapa integrado",
    desc: "Metrô + ônibus em um único mapa. Todas as linhas, paradas e conexões." },
  { tag: "Gestora", color: "#ef4444", icon: "✂️", title: "Corte de sobreposições",
    desc: "Detecta pares com >30% de trajeto duplicado. R$ 3.400/mês economizados em uma única rota." },
  { tag: "Gestora", color: "#ef4444", icon: "📊", title: "Score de frota",
    desc: "Lotação + Sustentabilidade − Ociosidade. Visão clara de quais rotas performam." },
  { tag: "Gestora", color: "#ef4444", icon: "⟳", title: "Terminal Virtual",
    desc: "Sincroniza alimentadoras com troncais. Espera máxima de 3 minutos na baldeação." },
  { tag: "Gestora", color: "#ef4444", icon: "↗", title: "Rotas Diametrais",
    desc: "Elimina a baldeação obrigatória na Rodoviária. −35 min por viagem para Ceilândia → SIA." },
  { tag: "Gestora", color: "#ef4444", icon: "🔥", title: "Controle de Frota",
    desc: "Mapa de calor de demanda ao vivo. Crie um evento, marque no mapa, redistribua ônibus em segundos." },
];

const SLIDES = [
  { id: "abertura",  label: "Abertura",   seconds: 20 },
  { id: "problema",  label: "Problema",   seconds: 35 },
  { id: "solucao",   label: "Solução",    seconds: 65 },
  { id: "ods",       label: "ODS",        seconds: 30 },
  { id: "fechamento",label: "Fechamento", seconds: 20 },
] as const;
type SlideId = typeof SLIDES[number]["id"];

const SCRIPT: Record<SlideId, string> = {
  abertura: `Todo dia, mais de 2 milhões de pessoas no Distrito Federal dependem do transporte público.

Mas esse sistema — cheio de linhas duplicadas, horários imprecisos e ônibus mal distribuídos — custa caro para quem paga impostos e rouba horas de vida de quem precisa chegar ao trabalho.`,

  problema: `Maria sai de Ceilândia para o SIA. São 2 horas e 20 minutos, duas baldeações, espera na incerteza — e nenhuma informação em tempo real.

Isso se repete 2 milhões de vezes por dia.

Para as concessionárias, linhas sobrepostas consomem orçamento que poderia melhorar a frota. Para a SEMOB, um jogo do Brasil paralisa bairros inteiros por falta de planejamento de frota.`,

  solucao: `Apresentamos o MobiDF AI — uma plataforma que conecta dados reais da SEMOB com inteligência artificial, em tempo real.

Para o cidadão: GPS de 3.312 ônibus ao vivo. Você sabe exatamente quando chegar ao ponto. Predição de conforto — vai sentado ou em pé, baseado na ocupação real. Metrô e ônibus integrados em um único mapa.

Para a gestora: detecção automática de sobreposição de linhas — R$ 3.400 por mês de economia em um único par de rotas. Terminal Virtual que sincroniza alimentadoras com troncais, reduzindo a espera para 3 minutos. Rotas Diametrais que eliminam a baldeação obrigatória na Rodoviária.

E o Controle de Frota com mapa de calor: crie um evento — um jogo do Brasil — marque no mapa, e o sistema indica os ônibus mais próximos para redirecionar. Em segundos.`,

  ods: `E tudo isso está alinhado com os Objetivos de Desenvolvimento Sustentável da ONU.

ODS 11 — Cidades Sustentáveis: frota redistribuída por demanda real, sem desperdício.

ODS 10 — Redução das Desigualdades: quem mora em Ceilândia tem a mesma informação em tempo real que qualquer um.

ODS 13 — Ação Climática: menos ônibus vazios circulando significa menos carbono.

ODS 3 — Saúde e Bem-Estar: Maria recupera 35 minutos por dia — 12,8 horas por mês de vida devolvida.

ODS 8 — a economia gerada é reinvestida em Wi-Fi e ar condicionado nos ônibus.`,

  fechamento: `MobiDF AI não é um dashboard bonito.

É infraestrutura de decisão — conectada a dados públicos reais, funcionando agora.

Qualquer gestora do DF pode entrar, criar um evento, e redistribuir a frota em segundos.

O transporte público do Distrito Federal já tem os dados. O que faltava era a inteligência.`,
};

export default function PitchPage() {
  const [slide, setSlide] = useState<SlideId>("abertura");
  const [mode, setMode] = useState<"slides" | "full">("slides");
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  const totalSeconds = 180;
  const pct = Math.min((elapsed / totalSeconds) * 100, 100);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const overtime = elapsed > totalSeconds;

  function resetTimer() { setElapsed(0); setRunning(false); }

  const currentIdx = SLIDES.findIndex(s => s.id === slide);

  function nextSlide() {
    if (currentIdx < SLIDES.length - 1) setSlide(SLIDES[currentIdx + 1].id);
  }
  function prevSlide() {
    if (currentIdx > 0) setSlide(SLIDES[currentIdx - 1].id);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "t" || e.key === "T") setRunning(r => !r);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", fontFamily: "system-ui,sans-serif",
      color: "#fff" }}>

      {/* ── Barra de controle ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100,
        background: "rgba(7,9,15,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo variant="full" height={26} />
          <span style={{ fontSize: 11, color: "#475569", padding: "2px 8px",
            background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>Pitch · 3 min</span>
        </div>

        {/* Cronômetro */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 900,
            color: overtime ? "#ef4444" : elapsed > 150 ? "#f59e0b" : "#22c55e",
            minWidth: 52 }}>
            {mm}:{ss}
          </div>
          <button onClick={() => setRunning(r => !r)} style={{
            padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            background: running ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)",
            color: running ? "#f87171" : "#4ade80", fontWeight: 700, fontSize: 12 }}>
            {running ? "⏸ Pausar" : "▶ Iniciar"}
          </button>
          <button onClick={resetTimer} style={{ padding: "6px 12px", borderRadius: 8,
            border: "none", cursor: "pointer", background: "rgba(255,255,255,0.07)",
            color: "#64748b", fontSize: 12 }}>↺</button>
        </div>

        {/* Barra de progresso */}
        <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.08)",
          borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, transition: "width 0.5s linear",
            background: overtime ? "#ef4444" : "linear-gradient(90deg,#6366f1,#22c55e)" }} />
        </div>
      </div>

      {/* ── Tabs de modo ── */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 20px" }}>
        {(["slides", "full"] as const).map(md => (
          <button key={md} onClick={() => setMode(md)} style={{
            padding: "10px 16px", border: "none", cursor: "pointer", background: "transparent",
            fontSize: 12, fontWeight: 700,
            color: mode === md ? "#6366f1" : "#475569",
            borderBottom: `2px solid ${mode === md ? "#6366f1" : "transparent"}` }}>
            {md === "slides" ? "📊 Slides" : "📄 Roteiro completo"}
          </button>
        ))}
      </div>

      {/* ════════════════════════
          MODO SLIDES
      ════════════════════════ */}
      {mode === "slides" && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 110px)" }}>

          {/* Nav de slides */}
          <div style={{ display: "flex", gap: 6, padding: "14px 20px",
            overflowX: "auto", flexShrink: 0 }}>
            {SLIDES.map((s, i) => (
              <button key={s.id} onClick={() => setSlide(s.id)} style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 99, border: "none",
                cursor: "pointer", fontSize: 11, fontWeight: 700,
                background: slide === s.id ? "#6366f1" : "rgba(255,255,255,0.06)",
                color: slide === s.id ? "#fff" : "#64748b" }}>
                {i + 1}. {s.label}
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{s.seconds}s</span>
              </button>
            ))}
          </div>

          {/* Conteúdo do slide */}
          <div style={{ flex: 1, padding: "0 20px 20px" }}>
            <AnimatePresence mode="wait">
              <motion.div key={slide}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>

                {/* ── ABERTURA ── */}
                {slide === "abertura" && (
                  <div style={{ maxWidth: 760, margin: "0 auto", paddingTop: 40 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", letterSpacing: "0.12em",
                      textTransform: "uppercase", marginBottom: 16 }}>Abertura · 20 segundos</div>
                    <h1 style={{ fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, lineHeight: 1.15,
                      letterSpacing: "-0.03em", margin: "0 0 24px" }}>
                      2 milhões de pessoas.<br />
                      <span style={{ color: "#6366f1" }}>Zero inteligência</span> no sistema.
                    </h1>
                    <p style={{ fontSize: "clamp(15px,2vw,20px)", color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
                      Todo dia, mais de 2 milhões de pessoas no DF dependem do transporte público.
                      Linhas duplicadas, horários imprecisos e ônibus mal distribuídos custam caro
                      para quem paga impostos — e roubam horas de vida de quem trabalha longe.
                    </p>
                    <div style={{ marginTop: 40, display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
                      {[
                        { n: "2M+",   l: "passageiros/dia", c: "#6366f1" },
                        { n: "6.687", l: "paradas reais",   c: "#22c55e" },
                        { n: "3.312", l: "ônibus ao vivo",  c: "#f59e0b" },
                        { n: "29",    l: "estações de metrô",c: "#ec4899" },
                      ].map(k => (
                        <div key={k.l} style={{ background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 14px" }}>
                          <div style={{ fontSize: 28, fontWeight: 900, color: k.c }}>{k.n}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{k.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── PROBLEMA ── */}
                {slide === "problema" && (
                  <div style={{ maxWidth: 760, margin: "0 auto", paddingTop: 32 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", letterSpacing: "0.12em",
                      textTransform: "uppercase", marginBottom: 16 }}>Problema · 35 segundos</div>
                    <h2 style={{ fontSize: "clamp(22px,4vw,38px)", fontWeight: 900, margin: "0 0 28px",
                      letterSpacing: "-0.02em" }}>
                      Maria. Ceilândia → SIA.<br />
                      <span style={{ color: "#ef4444" }}>2h20. Todo dia.</span>
                    </h2>
                    <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                      {PROBLEMS.map((p, i) => (
                        <motion.div key={p.title}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          style={{ display: "flex", gap: 12, padding: "14px 16px",
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12,
                            alignItems: "flex-start" }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{p.title}</div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── SOLUÇÃO ── */}
                {slide === "solucao" && (
                  <div style={{ maxWidth: 820, margin: "0 auto", paddingTop: 32 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#22c55e", letterSpacing: "0.12em",
                      textTransform: "uppercase", marginBottom: 16 }}>Solução · 65 segundos</div>
                    <h2 style={{ fontSize: "clamp(20px,3.5vw,34px)", fontWeight: 900, margin: "0 0 24px",
                      letterSpacing: "-0.02em" }}>
                      MobiDF AI — dados reais da SEMOB.<br />
                      <span style={{ color: "#22c55e" }}>Inteligência em tempo real.</span>
                    </h2>
                    <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
                      {SOLUTIONS.map((s, i) => (
                        <motion.div key={s.title}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          style={{ padding: "14px 16px",
                            background: s.tag === "Cidadão"
                              ? "rgba(99,102,241,0.07)" : "rgba(239,68,68,0.07)",
                            border: `1px solid ${s.tag === "Cidadão"
                              ? "rgba(99,102,241,0.2)" : "rgba(239,68,68,0.2)"}`,
                            borderRadius: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 18 }}>{s.icon}</span>
                            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
                              textTransform: "uppercase", padding: "2px 7px", borderRadius: 99,
                              background: s.tag === "Cidadão"
                                ? "rgba(99,102,241,0.2)" : "rgba(239,68,68,0.2)",
                              color: s.tag === "Cidadão" ? "#a5b4fc" : "#fca5a5" }}>
                              {s.tag}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                            {s.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{s.desc}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── ODS ── */}
                {slide === "ods" && (
                  <div style={{ maxWidth: 760, margin: "0 auto", paddingTop: 32 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.12em",
                      textTransform: "uppercase", marginBottom: 16 }}>ODS · 30 segundos</div>
                    <h2 style={{ fontSize: "clamp(20px,3.5vw,34px)", fontWeight: 900, margin: "0 0 28px",
                      letterSpacing: "-0.02em" }}>
                      Alinhado com{" "}
                      <span style={{ color: "#f59e0b" }}>6 Objetivos de Desenvolvimento Sustentável</span>
                    </h2>
                    <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                      {ODS.map((o, i) => (
                        <motion.div key={o.num}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.08 }}
                          style={{ padding: "18px 16px",
                            background: `${o.color}0f`,
                            border: `1px solid ${o.color}30`,
                            borderRadius: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                              background: `${o.color}20`, border: `1px solid ${o.color}40`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 20 }}>{o.icon}</div>
                            <div>
                              <div style={{ fontSize: 10, color: o.color, fontWeight: 800,
                                letterSpacing: "0.08em" }}>ODS {o.num}</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{o.title}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{o.desc}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── FECHAMENTO ── */}
                {slide === "fechamento" && (
                  <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 60, textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", letterSpacing: "0.12em",
                      textTransform: "uppercase", marginBottom: 24 }}>Fechamento · 20 segundos</div>
                    <h2 style={{ fontSize: "clamp(24px,4.5vw,48px)", fontWeight: 900, lineHeight: 1.2,
                      letterSpacing: "-0.03em", margin: "0 0 28px" }}>
                      O transporte do DF já tem os dados.<br />
                      <span style={{ color: "#6366f1" }}>O que faltava era a inteligência.</span>
                    </h2>
                    <p style={{ fontSize: "clamp(14px,2vw,18px)", color: "#64748b",
                      lineHeight: 1.7, margin: "0 0 40px" }}>
                      Qualquer gestora do DF pode entrar, criar um evento,
                      e redistribuir a frota em segundos.
                      Infraestrutura de decisão — conectada a dados reais, funcionando agora.
                    </p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                      {["/cidadao","/gestor","/gestora"].map(href => (
                        <a key={href} href={href} style={{ padding: "12px 24px", borderRadius: 12,
                          background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                          textDecoration: "none", fontWeight: 700, fontSize: 13,
                          border: "1px solid rgba(99,102,241,0.25)" }}>
                          Ver {href.slice(1)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navegação inferior */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0, gap: 12 }}>
            <button onClick={prevSlide} disabled={currentIdx === 0}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none",
                background: "rgba(255,255,255,0.07)", color: "#94a3b8",
                cursor: currentIdx === 0 ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 700, opacity: currentIdx === 0 ? 0.4 : 1 }}>
              ← Anterior
            </button>
            <div style={{ fontSize: 11, color: "#475569" }}>
              {currentIdx + 1} / {SLIDES.length} · ← → ou espaço para navegar · T para timer
            </div>
            <button onClick={nextSlide} disabled={currentIdx === SLIDES.length - 1}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none",
                background: currentIdx === SLIDES.length - 1
                  ? "rgba(255,255,255,0.07)" : "#6366f1",
                color: "#fff",
                cursor: currentIdx === SLIDES.length - 1 ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 700,
                opacity: currentIdx === SLIDES.length - 1 ? 0.4 : 1 }}>
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════
          MODO ROTEIRO COMPLETO
      ════════════════════════ */}
      {mode === "full" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 60px" }}>
          <div style={{ marginBottom: 28, padding: "14px 18px",
            background: "rgba(99,102,241,0.08)", borderRadius: 12,
            border: "1px solid rgba(99,102,241,0.2)",
            fontSize: 13, color: "#a5b4fc", lineHeight: 1.6 }}>
            💡 Ritmo sugerido: ~150 palavras/minuto. Total: ~420 palavras · 3 minutos.
            Use o cronômetro no topo enquanto lê.
          </div>

          {SLIDES.map((s, idx) => (
            <div key={s.id} style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: "rgba(99,102,241,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 900, color: "#a5b4fc" }}>{idx + 1}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "#475569",
                  background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 99 }}>
                  {s.seconds}s
                </div>
              </div>
              <div style={{ paddingLeft: 38,
                fontSize: 16, color: "#cbd5e1", lineHeight: 1.85,
                whiteSpace: "pre-line",
                borderLeft: "2px solid rgba(99,102,241,0.25)" }}>
                {SCRIPT[s.id]}
              </div>
            </div>
          ))}

          <div style={{ padding: "20px 24px", borderRadius: 14, marginTop: 20,
            background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#4ade80", marginBottom: 12 }}>
              ODS presentes no pitch
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ODS.map(o => (
                <div key={o.num} style={{ display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 99,
                  background: `${o.color}15`, border: `1px solid ${o.color}30` }}>
                  <span style={{ fontSize: 14 }}>{o.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: o.color }}>ODS {o.num}</span>
                  <span style={{ fontSize: 10, color: "#475569" }}>{o.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
