"use client";

interface Props {
  pct: number;
  nivel: "vazio" | "moderado" | "lotado";
  minutos?: number;
}

const configs = {
  vazio: { color: "bg-green-500", label: "Vazio", text: "text-green-700" },
  moderado: { color: "bg-yellow-400", label: "Moderado", text: "text-yellow-700" },
  lotado: { color: "bg-red-500", label: "Lotado", text: "text-red-700" },
};

export default function OccupancyBar({ pct, nivel, minutos }: Props) {
  const cfg = configs[nivel] || configs.vazio;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
          <span className="text-gray-400">{Math.min(100, pct)}% ocupado</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${cfg.color}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
      {minutos !== undefined && (
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-black">{Math.round(minutos)}</div>
          <div className="text-xs text-gray-400">min</div>
        </div>
      )}
    </div>
  );
}
