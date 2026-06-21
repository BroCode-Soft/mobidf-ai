interface LogoProps {
  variant?: "full" | "mark";
  height?: number;
  className?: string;
}

/* ── Mark — M com gradiente violeta→índigo, traço duplo, nó central ── */
function Mark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mg-outer" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="mg-inner" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#9333ea" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.6" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Traço externo do M */}
      <path
        d="M14 82 L14 22 L50 58 L86 22 L86 82"
        stroke="url(#mg-outer)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
      />

      {/* Traço interno (efeito duplo de rota de trânsito) */}
      <path
        d="M21 76 L21 32 L50 58 L79 32 L79 76"
        stroke="url(#mg-inner)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Nó central — ponto de GPS/sinal ao vivo */}
      <circle cx="50" cy="58" r="5.5" fill="#818cf8" filter="url(#glow)" />
      <circle cx="50" cy="58" r="3"   fill="#c4b5fd" />
    </svg>
  );
}

export default function Logo({ variant = "full", height = 32, className }: LogoProps) {
  if (variant === "mark") {
    return (
      <span className={className} style={{ display: "inline-flex", alignItems: "center", height }}>
        <Mark size={height} />
      </span>
    );
  }

  /* full — mark + "MobiDF" + "AI" */
  const markSize = Math.round(height * 1.1);
  const fontSize = Math.round(height * 0.72);
  const aiSize   = Math.round(height * 0.52);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(height * 0.28),
        height,
        lineHeight: 1,
      }}
    >
      <Mark size={markSize} />
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
        <span
          style={{
            fontSize,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.03em",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          MobiDF
        </span>
        <span
          style={{
            fontSize: aiSize,
            fontWeight: 800,
            color: "#818cf8",
            letterSpacing: "-0.01em",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          AI
        </span>
      </span>
    </span>
  );
}
