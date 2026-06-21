"use client";
import { useState } from "react";

export interface MobiUser {
  nome: string;
  email: string;
  token: string;
}

function randomToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

interface Props {
  onClose: () => void;
  onLogin: (user: MobiUser) => void;
}

export default function AuthModal({ onClose, onLogin }: Props) {
  const [nome, setNome]   = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep]   = useState<"form" | "sending" | "done">("form");

  function handleEntrar() {
    if (!nome.trim() || !email.trim()) return;
    setStep("sending");
    // Simula envio de link mágico → loga automaticamente após 1.5s
    setTimeout(() => {
      setStep("done");
      setTimeout(() => {
        const user: MobiUser = { nome: nome.trim(), email: email.trim(), token: randomToken() };
        localStorage.setItem("mobidf_user", JSON.stringify(user));
        onLogin(user);
      }, 1200);
    }, 1500);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0f172a", border: "1px solid #1e293b",
          borderRadius: 20, padding: 28, width: "100%", maxWidth: 380,
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
            Acesse seus benefícios
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Crie sua conta gratuita para gerar QR Codes de desconto
          </div>
        </div>

        {step === "form" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>
                SEU NOME
              </label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Maria Silva"
                style={{
                  width: "100%", background: "#1e293b", border: "1px solid #334155",
                  borderRadius: 10, padding: "10px 12px", color: "#f8fafc",
                  fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>
                SEU E-MAIL
              </label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                placeholder="maria@email.com"
                onKeyDown={e => e.key === "Enter" && handleEntrar()}
                style={{
                  width: "100%", background: "#1e293b", border: "1px solid #334155",
                  borderRadius: 10, padding: "10px 12px", color: "#f8fafc",
                  fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={handleEntrar}
              disabled={!nome.trim() || !email.trim()}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
                background: nome.trim() && email.trim()
                  ? "linear-gradient(135deg,#7c3aed,#6366f1)"
                  : "#1e293b",
                color: nome.trim() && email.trim() ? "#fff" : "#475569",
                fontSize: 14, fontWeight: 700, cursor: nome.trim() && email.trim() ? "pointer" : "default",
                transition: "all 0.2s",
              }}
            >
              Entrar e acessar desconto →
            </button>
            <div style={{ marginTop: 12, textAlign: "center", fontSize: 10, color: "#475569" }}>
              Ao entrar você concorda com os Termos de Uso · Gratuito sempre
            </div>
          </>
        )}

        {step === "sending" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Verificando identidade…</div>
          </div>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 14 }}>
              Bem-vindo, {nome.split(" ")[0]}!
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              Gerando seu QR Code…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
