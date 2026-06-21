"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "@/components/ui/Logo";

const ease: [number,number,number,number] = [0.16, 1, 0.3, 1];

const FEATURES = [
  { icon: "⚡", title: "Terminal Virtual", desc: "Sincroniza linhas alimentadoras com troncais em ≤ 3 min de espera", color: "#8b5cf6" },
  { icon: "↗", title: "Rota Diametral", desc: "Detecta fluxo pendular e elimina baldeação no Plano Piloto", color: "#10b981" },
  { icon: "✂", title: "Corte Fantasma", desc: "PostGIS identifica ônibus vazios em trajetos sobrepostos", color: "#f43f5e" },
  { icon: "🎫", title: "Reserva de Fluxo", desc: "Check-in digital garante assento e alimenta o painel preditivo", color: "#f59e0b" },
];

export default function Home() {
  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh", overflow: "hidden" }}>

      {/* Ambient lights */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div style={{ position:"absolute", top:"-20%", left:"30%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 65%)" }} />
        <div style={{ position:"absolute", bottom:"-10%", right:"10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(16,185,129,0.1) 0%,transparent 65%)" }} />
        <div style={{ position:"absolute", top:"40%", left:"-10%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(139,92,246,0.12) 0%,transparent 65%)" }} />
      </div>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none opacity-30" aria-hidden="true"
        style={{ backgroundImage:"radial-gradient(circle, rgba(139,92,246,0.3) 1px, transparent 1px)", backgroundSize:"32px 32px" }} />

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5, ease }}>
          <Logo variant="full" height={34} />
        </motion.div>
        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5, ease }} className="flex items-center gap-2">
          <Link href="/cidadao" className="btn-ghost text-xs px-4 py-2">App Cidadão</Link>
          <Link href="/gestor" className="btn-volt text-xs px-4 py-2">Dashboard →</Link>
        </motion.div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-20 max-w-5xl mx-auto">
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.7, ease }}>
          <div className="badge-volt mb-6 mx-auto" style={{ fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase" }}>
            <span className="live mr-2" /> MVP · Hackathon 2026
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.2, duration:0.8, ease }}
          style={{ fontSize:"clamp(2.5rem,7vw,5.5rem)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.05, color:"var(--t1)", marginBottom:24 }}>
          Transporte público
          <br />
          <span style={{ background:"linear-gradient(135deg,#a78bfa 0%,#818cf8 40%,#6366f1 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            orquestrado por IA
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.35, duration:0.7, ease }}
          style={{ fontSize:18, color:"var(--t2)", maxWidth:520, lineHeight:1.7, marginBottom:40 }}>
          Eficiência de BRT sem construir nada.
          Dados públicos, PostGIS e GTFS-RT em tempo real para o DF.
        </motion.p>

        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.45, duration:0.6, ease }}
          className="flex flex-col sm:flex-row gap-3 mb-20">
          <Link href="/gestor" className="btn-volt px-8 py-4 text-base rounded-2xl" style={{ boxShadow:"0 0 50px -8px rgba(99,102,241,0.7)" }}>
            Abrir Mission Control
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
          <Link href="/cidadao" className="btn-ghost px-8 py-4 text-base rounded-2xl">
            App Cidadão
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
          </Link>
        </motion.div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: 0.55 + i * 0.08, duration:0.6, ease }}
              className="panel p-5 text-left flex gap-4 items-start"
              style={{ cursor:"default" }}>
              <div style={{ width:42, height:42, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0, background:`${f.color}18`, border:`1px solid ${f.color}30` }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:"var(--t1)", marginBottom:4 }}>{f.title}</div>
                <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.5 }}>{f.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ODS strip */}
        <motion.div
          initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.9, duration:0.6 }}
          className="flex flex-wrap justify-center gap-2 mt-10">
          {[["11","#f59e0b","Cidades"],["9","#8b5cf6","Inovação"],["10","#ec4899","Igualdade"],["13","#10b981","Clima"]].map(([n,c,t]) => (
            <div key={n} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 14px 6px 8px", borderRadius:99, background:"var(--s3)", border:"1px solid var(--b1)", fontSize:12 }}>
              <span style={{ width:22, height:22, borderRadius:6, background:c as string, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, color:"#fff" }}>{n}</span>
              <span style={{ color:"var(--t2)" }}>ODS {t}</span>
            </div>
          ))}
        </motion.div>
      </section>
    </main>
  );
}
