"use client";
import { useEffect, useState } from "react";
import type { Parceiro, QRCodeResult } from "@/lib/api";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import type { MobiUser } from "./AuthModal";

interface Props {
  parceiro: Parceiro;
  user: MobiUser;
  onClose: () => void;
}

export default function QRCodeModal({ parceiro, user, onClose }: Props) {
  const [qr, setQr] = useState<QRCodeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [secsLeft, setSecsLeft] = useState(900);

  useEffect(() => {
    api.cidadao.gerarQRCode(parceiro.id, user.token)
      .then(res => {
        setQr(res);
        setLoading(false);
        trackEvent("qr_generated", `${parceiro.id}:${user.email}`);
      })
      .catch(() => setLoading(false));
  }, [parceiro.id, user.token, parceiro.id, user.email]);

  // Conta regressiva
  useEffect(() => {
    if (!qr) return;
    const interval = setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [qr]);

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const expired = secsLeft <= 0;

  const qrUrl = qr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qr.qr_data)}&bgcolor=0f172a&color=a5b4fc&margin=10`
    : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.85)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0f172a", border: "1px solid #1e293b",
          borderRadius: 24, padding: 24, width: "100%", maxWidth: 360,
          boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho do parceiro */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: parceiro.cor + "22", border: `2px solid ${parceiro.cor}44`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          }}>
            {parceiro.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", lineHeight: 1.2 }}>
              {parceiro.nome}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {parceiro.horario}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#475569",
            fontSize: 18, cursor: "pointer", padding: 4,
          }}>✕</button>
        </div>

        {/* Destaque do desconto */}
        <div style={{
          background: "linear-gradient(135deg,#7c3aed22,#6366f122)",
          border: "1px solid #7c3aed44", borderRadius: 12,
          padding: "10px 14px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, marginBottom: 3 }}>
            🎁 SEU BENEFÍCIO
          </div>
          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, lineHeight: 1.4 }}>
            {parceiro.desconto}
          </div>
        </div>

        {/* QR Code */}
        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b", fontSize: 13 }}>
            Gerando QR Code…
          </div>
        )}

        {!loading && qr && (
          <>
            {expired ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32 }}>⏰</div>
                <div style={{ color: "#f43f5e", fontWeight: 700, marginTop: 8 }}>QR Code expirado</div>
                <button
                  onClick={() => { setSecsLeft(900); setLoading(true);
                    api.cidadao.gerarQRCode(parceiro.id, user.token)
                      .then(r => { setQr(r); setLoading(false); });
                  }}
                  style={{
                    marginTop: 12, padding: "8px 20px", borderRadius: 10,
                    background: "#7c3aed", border: "none", color: "#fff",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Gerar novo
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl!}
                    alt="QR Code desconto"
                    width={220} height={220}
                    style={{ borderRadius: 12, border: "2px solid #1e293b" }}
                  />
                </div>

                {/* Código manual */}
                <div style={{
                  textAlign: "center", background: "#1e293b",
                  borderRadius: 10, padding: "8px 0", marginBottom: 12,
                }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>
                    CÓDIGO MANUAL
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#a5b4fc", letterSpacing: 3 }}>
                    {qr.code}
                  </div>
                </div>

                {/* Timer */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 12, color: secsLeft < 120 ? "#f59e0b" : "#64748b",
                }}>
                  <span>{secsLeft < 120 ? "⚠️" : "⏳"}</span>
                  <span>Válido por <strong>{mins}:{String(secs).padStart(2, "0")}</strong> min</span>
                </div>
              </>
            )}
          </>
        )}

        {/* ODS badges */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          {parceiro.ods.map(o => (
            <span key={o} style={{
              fontSize: 10, fontWeight: 700, color: "#818cf8",
              background: "#1e293b", borderRadius: 99, padding: "3px 8px",
              border: "1px solid #334155",
            }}>
              {o}
            </span>
          ))}
          <span style={{
            fontSize: 10, fontWeight: 700, color: "#94a3b8",
            background: "#1e293b", borderRadius: 99, padding: "3px 8px",
            border: "1px solid #334155",
          }}>
            👤 {user.nome.split(" ")[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
